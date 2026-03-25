#!/usr/bin/env python3
"""
Sync Bog Factor tracklists from shows.json to Spotify and Tidal playlists.

Usage:
    python sync-playlists.py                    # sync all configured services
    python sync-playlists.py --dry-run          # preview without making changes
    python sync-playlists.py --service spotify   # sync only Spotify
    python sync-playlists.py --service tidal     # sync only Tidal

Environment variables (or .env file in repo root):
    SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
    TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET, TIDAL_REFRESH_TOKEN

First-time setup:
    python sync-playlists.py --setup spotify
    python sync-playlists.py --setup tidal
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

# Load .env from repo root if present
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

PLAYLIST_NAME = "Bog Factor"
PLAYLIST_DESCRIPTION = "Every track played on Bog Factor, a monthly radio show on EHFM Edinburgh. bogfactor.co.uk"
SHOWS_JSON = Path(__file__).resolve().parent.parent / "radio" / "shows.json"


def normalise(text):
    """Normalise unicode, quotes, punctuation and whitespace for comparison."""
    text = unicodedata.normalize("NFC", text.strip().lower())
    # Normalise curly quotes/apostrophes to straight
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    # Normalise dashes to simple hyphen
    text = text.replace('\u2013', '-').replace('\u2014', '-')
    # Normalise & / and
    text = re.sub(r'\s*&\s*', ' and ', text)
    # Collapse multiple spaces
    text = re.sub(r'\s+', ' ', text)
    return text


# Patterns for cleaning search queries and matching results
_FEAT_RE = re.compile(
    r'\s*(feat\.?|featuring|ft\.?)\s*.+', re.IGNORECASE
)
_THE_SUFFIX_RE = re.compile(r'^(.+),\s*The$', re.IGNORECASE)
_TRACK_NUM_RE = re.compile(r'^\d{1,3}[\.\)]\s*')
_PARENS_RE = re.compile(r'\s*\([^)]*\)')


def clean_artist(artist):
    """Strip feat./featuring, flip ', The' suffix, remove @ prefix, handle /."""
    if not artist:
        return artist
    # Remove @ prefix (e.g. @Electrecord)
    artist = artist.lstrip('@')
    # Strip "feat. X" / "featuring X" etc.
    artist = _FEAT_RE.sub('', artist).strip()
    # Flip "Velvet Underground, The" -> "The Velvet Underground"
    m = _THE_SUFFIX_RE.match(artist)
    if m:
        artist = f"The {m.group(1).strip()}"
    # Take first artist before "/" (e.g. "Ken Nordine/Dick Campbell" -> "Ken Nordine")
    if '/' in artist:
        artist = artist.split('/')[0].strip()
    return artist


def clean_title(title):
    """Strip track number prefixes and parenthetical version info."""
    # Remove leading track numbers like "06." or "3)"
    title = _TRACK_NUM_RE.sub('', title).strip()
    return title


def strip_parens(text):
    """Remove all parenthetical content for fuzzy retry."""
    return _PARENS_RE.sub('', text).strip()


def normalise_loose(text):
    """Extra-loose normalisation: strip all punctuation and extra whitespace."""
    text = normalise(text)
    # Replace hyphens with spaces (so "I'm-a" becomes "I'm a" before punct strip)
    text = text.replace('-', ' ')
    text = re.sub(r'[^\w\s]', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def parse_track(entry):
    """Parse a 'Title - Artist' string into (title, artist) tuple.
    Handles entries with multiple ' - ' separators by dropping trailing
    segments that look like labels (e.g. @Electrecord, Records, etc.)."""
    parts = entry.split(" - ")
    if len(parts) >= 3:
        # Drop the last segment if it looks like a label or extra info
        last = parts[-1].strip()
        if last.startswith('@') or last.lower().endswith('records'):
            parts = parts[:-1]
        # Rejoin: first part is title, rest is artist
        title = parts[0].strip()
        artist = " - ".join(parts[1:]).strip()
        title = clean_title(title)
        return title, artist
    if len(parts) == 2:
        title = clean_title(parts[0].strip())
        return title, parts[1].strip()
    return clean_title(entry.strip()), None


def load_tracks():
    """Load all unique tracks from shows.json, preserving order (newest first)."""
    with open(SHOWS_JSON, "r", encoding="utf-8") as f:
        shows = json.load(f)

    seen = set()
    tracks = []
    for show in shows:
        for entry in show.get("tracklist", []):
            title, artist = parse_track(entry)
            # Skip joke/placeholder entries
            if artist is None and not looks_like_real_track(title):
                continue
            key = normalise(f"{title} - {artist or ''}")
            if key not in seen:
                seen.add(key)
                tracks.append((title, artist, show.get("title", "")))
    return tracks


def looks_like_real_track(title):
    """Heuristic: a title-only entry is real if it's short-ish and looks like a song name."""
    # Filter out things like "That's a secret we'll never tell"
    return len(title) < 40 and not any(w in title.lower() for w in ["secret", "never tell"])


# ---------------------------------------------------------------------------
# Spotify
# ---------------------------------------------------------------------------

def spotify_setup():
    """Interactive OAuth setup for Spotify. Run once to get a refresh token."""
    try:
        import spotipy
        from spotipy.oauth2 import SpotifyOAuth
    except ImportError:
        print("Install spotipy first: pip install spotipy", file=sys.stderr)
        return

    client_id = input("Spotify Client ID: ").strip()
    client_secret = input("Spotify Client Secret: ").strip()

    auth = SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri="http://localhost:8888/callback",
        scope="playlist-modify-public playlist-modify-private playlist-read-private",
    )

    print("\nA browser window will open. Log in and authorise the app.")
    print("After redirect, copy the full URL from your browser and paste it below.\n")

    token_info = auth.get_access_token(auth.get_auth_response())

    print("\n--- Add these to your .env or GitHub Actions secrets ---")
    print(f"SPOTIFY_CLIENT_ID={client_id}")
    print(f"SPOTIFY_CLIENT_SECRET={client_secret}")
    print(f"SPOTIFY_REFRESH_TOKEN={token_info['refresh_token']}")
    print("--------------------------------------------------------")


def spotify_sync(tracks, dry_run=False):
    """Sync tracks to a Spotify playlist."""
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    refresh_token = os.environ.get("SPOTIFY_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        print("Spotify: skipping (credentials not configured)")
        return

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyOAuth
    except ImportError:
        print("Spotify: skipping (spotipy not installed)", file=sys.stderr)
        return

    print("\n=== Spotify ===")

    auth = SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri="http://localhost:8888/callback",
        scope="playlist-modify-public playlist-modify-private playlist-read-private",
    )
    # Use the refresh token to get a fresh access token
    token_info = auth.refresh_access_token(refresh_token)
    sp = spotipy.Spotify(auth=token_info["access_token"])

    user = sp.current_user()
    user_id = user["id"]
    print(f"Authenticated as: {user['display_name']} ({user_id})")

    # Find or create playlist
    playlist_id = None
    playlists = sp.current_user_playlists(limit=50)
    while playlists:
        for pl in playlists["items"]:
            if pl["name"] == PLAYLIST_NAME and pl["owner"]["id"] == user_id:
                playlist_id = pl["id"]
                break
        if playlist_id or not playlists["next"]:
            break
        playlists = sp.next(playlists)

    if not playlist_id:
        if dry_run:
            print(f"Would create playlist: {PLAYLIST_NAME}")
        else:
            new_pl = sp.user_playlist_create(user_id, PLAYLIST_NAME, public=True,
                                              description=PLAYLIST_DESCRIPTION)
            playlist_id = new_pl["id"]
            print(f"Created playlist: {PLAYLIST_NAME}")
    else:
        print(f"Found existing playlist: {PLAYLIST_NAME}")

    # Get existing track URIs in the playlist
    existing_uris = set()
    if playlist_id:
        results = sp.playlist_items(playlist_id, fields="items.track.uri,next", limit=100)
        while results:
            for item in results["items"]:
                if item["track"] and item["track"]["uri"]:
                    existing_uris.add(item["track"]["uri"])
            if not results["next"]:
                break
            results = sp.next(results)

    # Search for and add new tracks
    to_add = []
    not_found = []
    already_present = 0

    for title, artist, show_title in tracks:
        match = _spotify_search_with_retries(sp, title, artist)

        if match:
            if match["uri"] in existing_uris:
                already_present += 1
            else:
                to_add.append(match["uri"])
                existing_uris.add(match["uri"])
                if dry_run:
                    print(f"  Would add: {match['name']} - {match['artists'][0]['name']}")
        else:
            not_found.append(f"{title} - {artist or '?'} (from: {show_title})")

    if to_add and not dry_run:
        # Spotify allows max 100 tracks per request
        for i in range(0, len(to_add), 100):
            sp.playlist_add_items(playlist_id, to_add[i:i + 100])

    _print_summary("Spotify", len(to_add), already_present, not_found, dry_run)


def _spotify_search_with_retries(sp, title, artist):
    """Search Spotify with progressively looser queries."""
    queries = _build_search_queries(title, artist, spotify=True)
    for query in queries:
        try:
            results = sp.search(q=query, type="track", limit=5)
            match = _pick_best_match_spotify(results["tracks"]["items"], title, artist)
            if match:
                return match
        except Exception:
            continue
    return None


def _pick_best_match_spotify(items, title, artist):
    """Pick the best match from Spotify search results."""
    if not items:
        return None

    title_norm = normalise(clean_title(title))
    title_loose = normalise_loose(clean_title(title))
    artist_clean = clean_artist(artist)
    artist_norm = normalise(artist_clean) if artist_clean else None
    title_stripped = normalise(strip_parens(title))
    title_stripped_loose = normalise_loose(strip_parens(title))

    for item in items:
        item_title = normalise(item["name"])
        item_title_loose = normalise_loose(item["name"])
        item_artists = [normalise(a["name"]) for a in item["artists"]]

        title_ok = (item_title == title_norm or item_title == title_stripped
                    or item_title_loose == title_loose
                    or item_title_loose == title_stripped_loose)
        if title_ok:
            if artist_norm is None or _artist_matches(artist_norm, item_artists):
                return item

    # Fallback: partial title match
    for item in items:
        item_title = normalise(item["name"])
        item_title_loose = normalise_loose(item["name"])
        partial = (title_norm in item_title or item_title in title_norm
                   or title_stripped in item_title
                   or title_loose in item_title_loose
                   or item_title_loose in title_loose)
        if partial:
            if artist_norm is None:
                return item
            item_artists = [normalise(a["name"]) for a in item["artists"]]
            if _artist_matches(artist_norm, item_artists):
                return item

    return None


# ---------------------------------------------------------------------------
# Tidal
# ---------------------------------------------------------------------------

def tidal_setup():
    """Interactive OAuth setup for Tidal. Run once to get session credentials."""
    try:
        import tidalapi
    except ImportError:
        print("Install tidalapi first: pip install tidalapi", file=sys.stderr)
        return

    session = tidalapi.Session()
    session.login_oauth_simple()

    print("\n--- Add these to your .env or GitHub Actions secrets ---")
    print(f"TIDAL_TOKEN_TYPE={session.token_type}")
    print(f"TIDAL_ACCESS_TOKEN={session.access_token}")
    print(f"TIDAL_REFRESH_TOKEN={session.refresh_token}")
    print(f"TIDAL_EXPIRY_TIME={session.expiry_time}")
    print("--------------------------------------------------------")


def tidal_sync(tracks, dry_run=False):
    """Sync tracks to a Tidal playlist."""
    refresh_token = os.environ.get("TIDAL_REFRESH_TOKEN")

    if not refresh_token:
        print("Tidal: skipping (credentials not configured)")
        return

    try:
        import tidalapi
    except ImportError:
        print("Tidal: skipping (tidalapi not installed)", file=sys.stderr)
        return

    print("\n=== Tidal ===")

    session = tidalapi.Session()

    token_type = os.environ.get("TIDAL_TOKEN_TYPE", "Bearer")
    access_token = os.environ.get("TIDAL_ACCESS_TOKEN", "")
    expiry_time = os.environ.get("TIDAL_EXPIRY_TIME")

    # Try loading from saved session data, falling back to refresh
    try:
        from datetime import datetime
        exp = datetime.fromisoformat(expiry_time) if expiry_time else datetime.min
        session.load_oauth_session(token_type, access_token, refresh_token, exp)
    except Exception:
        # If loading fails, try just the refresh token
        try:
            session.load_oauth_session("Bearer", "", refresh_token)
        except Exception as e:
            print(f"Tidal: authentication failed: {e}", file=sys.stderr)
            return

    if not session.check_login():
        print("Tidal: session not valid, try running --setup tidal again", file=sys.stderr)
        return

    # After login/refresh, the session may have a new refresh token.
    # Output it so CI can persist the rotated token for next run.
    if session.refresh_token and session.refresh_token != refresh_token:
        print(f"TIDAL_REFRESH_TOKEN_ROTATED={session.refresh_token}")

    user = session.user
    print(f"Authenticated as user ID: {user.id}")

    # Find or create playlist
    playlist = None
    for pl in user.playlists():
        if pl.name == PLAYLIST_NAME:
            playlist = pl
            break

    if not playlist:
        if dry_run:
            print(f"Would create playlist: {PLAYLIST_NAME}")
        else:
            playlist = user.create_playlist(PLAYLIST_NAME, PLAYLIST_DESCRIPTION)
            print(f"Created playlist: {PLAYLIST_NAME}")
    else:
        print(f"Found existing playlist: {PLAYLIST_NAME}")

    # Get existing track IDs
    existing_ids = set()
    if playlist:
        for track in playlist.tracks():
            existing_ids.add(track.id)

    # Search and add
    to_add = []
    not_found = []
    already_present = 0

    for title, artist, show_title in tracks:
        match = _tidal_search_with_retries(session, tidalapi, title, artist)

        if match:
            if match.id in existing_ids:
                already_present += 1
            else:
                to_add.append(match.id)
                existing_ids.add(match.id)
                if dry_run:
                    print(f"  Would add: {match.name} - {match.artist.name}")
        else:
            not_found.append(f"{title} - {artist or '?'} (from: {show_title})")

    if to_add and not dry_run:
        # tidalapi add takes a list of track IDs
        playlist.add(to_add)

    _print_summary("Tidal", len(to_add), already_present, not_found, dry_run)


def _tidal_search_with_retries(session, tidalapi, title, artist):
    """Search Tidal with progressively looser queries."""
    queries = _build_search_queries(title, artist, spotify=False)
    for query in queries:
        try:
            results = session.search(query, models=[tidalapi.media.Track], limit=5)
            match = _pick_best_match_tidal(results["tracks"], title, artist)
            if match:
                return match
        except Exception:
            continue
    return None


def _pick_best_match_tidal(items, title, artist):
    """Pick the best match from Tidal search results."""
    if not items:
        return None

    title_norm = normalise(clean_title(title))
    title_loose = normalise_loose(clean_title(title))
    artist_clean = clean_artist(artist)
    artist_norm = normalise(artist_clean) if artist_clean else None
    artist_loose = normalise_loose(artist_clean) if artist_clean else None
    title_stripped = normalise(strip_parens(title))
    title_stripped_loose = normalise_loose(strip_parens(title))

    def artist_ok(item_artist_raw):
        if artist_norm is None:
            return True
        a = normalise(item_artist_raw)
        if artist_norm in a or a in artist_norm:
            return True
        a_clean = normalise(clean_artist(item_artist_raw))
        if artist_norm in a_clean or a_clean in artist_norm:
            return True
        # Loose comparison (strip punctuation)
        if artist_loose:
            a_loose = normalise_loose(item_artist_raw)
            if artist_loose in a_loose or a_loose in artist_loose:
                return True
        return False

    for item in items:
        item_title = normalise(item.name)
        item_title_loose = normalise_loose(item.name)
        title_ok = (item_title == title_norm or item_title == title_stripped
                    or item_title_loose == title_loose
                    or item_title_loose == title_stripped_loose)
        if title_ok and artist_ok(item.artist.name):
            return item

    # Fallback: partial match
    for item in items:
        item_title = normalise(item.name)
        item_title_loose = normalise_loose(item.name)
        partial = (title_norm in item_title or item_title in title_norm
                   or title_stripped in item_title
                   or title_loose in item_title_loose
                   or item_title_loose in title_loose)
        if partial and artist_ok(item.artist.name):
            return item

    return None


# ---------------------------------------------------------------------------
# Shared search helpers
# ---------------------------------------------------------------------------

def _artist_matches(artist_norm, item_artists):
    """Check if cleaned artist matches any of the item's artists."""
    if not artist_norm:
        return True
    artist_loose = normalise_loose(artist_norm)
    for a in item_artists:
        if artist_norm in a or a in artist_norm:
            return True
        a_clean = normalise(clean_artist(a))
        if artist_norm in a_clean or a_clean in artist_norm:
            return True
        a_loose = normalise_loose(a)
        if artist_loose in a_loose or a_loose in artist_loose:
            return True
    return False


def _build_search_queries(title, artist, spotify=False):
    """Build a list of search queries from most specific to least."""
    title_clean = clean_title(title)
    artist_clean = clean_artist(artist)
    title_stripped = strip_parens(title_clean)
    queries = []

    if spotify:
        if artist_clean:
            queries.append(f"track:{title_clean} artist:{artist_clean}")
        else:
            queries.append(f"track:{title_clean}")
        if title_stripped != title_clean and artist_clean:
            queries.append(f"track:{title_stripped} artist:{artist_clean}")
        if artist_clean:
            queries.append(f"{title_clean} {artist_clean}")
        # Swap title/artist (handles bad data)
        if artist_clean:
            queries.append(f"track:{artist_clean} artist:{title_clean}")
    else:
        if artist_clean:
            queries.append(f"{title_clean} {artist_clean}")
        else:
            queries.append(title_clean)
        if title_stripped != title_clean:
            if artist_clean:
                queries.append(f"{title_stripped} {artist_clean}")
            else:
                queries.append(title_stripped)
        # Retry with primary artist (before "and"/"&")
        if artist_clean and re.search(r'\s+(and|&)\s+', artist_clean, re.IGNORECASE):
            primary = re.split(r'\s+(and|&)\s+', artist_clean, maxsplit=1)[0]
            queries.append(f"{title_clean} {primary}")
        # Swap title/artist (handles bad data like "Mircea Florian - Cu pleoapa de argint")
        if artist_clean:
            queries.append(f"{artist_clean} {title_clean}")

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            unique.append(q)
    return unique


# ---------------------------------------------------------------------------
# Common
# ---------------------------------------------------------------------------

def _print_summary(service, added, already_present, not_found, dry_run):
    """Print a summary of the sync operation."""
    prefix = "DRY RUN - " if dry_run else ""
    print(f"\n{prefix}{service} summary:")
    print(f"  {'Would add' if dry_run else 'Added'}: {added}")
    print(f"  Already in playlist: {already_present}")
    print(f"  Not found: {len(not_found)}")

    if not_found:
        print(f"\n  Tracks not found on {service}:")
        for track in not_found:
            print(f"    - {track}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Sync Bog Factor tracklists to streaming playlists")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying playlists")
    parser.add_argument("--service", choices=["spotify", "tidal"], help="Sync only this service")
    parser.add_argument("--setup", choices=["spotify", "tidal"], help="Run interactive OAuth setup for a service")
    args = parser.parse_args()

    if args.setup:
        if args.setup == "spotify":
            spotify_setup()
        else:
            tidal_setup()
        return

    print(f"Loading tracks from {SHOWS_JSON}")
    tracks = load_tracks()
    print(f"Found {len(tracks)} unique tracks across all shows")

    if args.dry_run:
        print("DRY RUN MODE - no changes will be made\n")

    if args.service in (None, "spotify"):
        spotify_sync(tracks, dry_run=args.dry_run)

    if args.service in (None, "tidal"):
        tidal_sync(tracks, dry_run=args.dry_run)

    print("\nDone!")


if __name__ == "__main__":
    main()
