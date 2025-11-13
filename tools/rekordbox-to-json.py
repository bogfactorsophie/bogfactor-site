import json
import sys
import chardet

def detect_encoding(file_path):
    """
    Detect the encoding of a file.
    """
    with open(file_path, 'rb') as f:
        raw_data = f.read()
    result = chardet.detect(raw_data)
    return result['encoding']

def parse_rekordbox_playlist(file_path):
    """
    Parse a Rekordbox playlist file and extract track title and artist.
    
    Args:
        file_path: Path to the Rekordbox playlist text file
        
    Returns:
        List of strings in format "Track Title - Artist"
    """
    tracklist = []
    
    # Try different encodings
    encodings = ['utf-16', 'utf-16-le', 'utf-16-be', 'utf-8-sig', 'utf-8', 'latin-1', 'cp1252']
    
    file_content = None
    used_encoding = None
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                file_content = f.readlines()
            used_encoding = encoding
            print(f"Successfully read file using encoding: {encoding}")
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    if file_content is None:
        # Try with chardet as fallback
        try:
            detected_encoding = detect_encoding(file_path)
            print(f"Detected encoding: {detected_encoding}")
            with open(file_path, 'r', encoding=detected_encoding) as f:
                file_content = f.readlines()
            used_encoding = detected_encoding
        except:
            raise Exception("Could not decode file with any known encoding")
    
    # Skip the header line (starts with #)
    for line in file_content[1:]:
        line = line.strip()
        if not line:  # Skip empty lines
            continue
            
        # Split by tab character
        fields = line.split('\t')
        
        # We need at least 4 fields: #, Artwork, Track Title, Artist
        if len(fields) >= 4:
            track_title = fields[2].strip()
            artist = fields[3].strip()
            
            # Only add if both track title and artist exist
            if track_title and artist:
                tracklist.append(f"{track_title} - {artist}")
    
    return tracklist

def main():
    if len(sys.argv) < 2:
        print("Usage: python script.py <rekordbox_playlist_file>")
        print("Example: python script.py playlist.txt")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        tracklist = parse_rekordbox_playlist(input_file)
        
        # Create output dictionary
        output = {"tracklist": tracklist}
        
        # Print formatted JSON
        print(json.dumps(output, indent=2, ensure_ascii=False))
        
        # Optionally save to file
        output_file = input_file.rsplit('.', 1)[0] + '_tracklist.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\nTracklist saved to: {output_file}")
        print(f"Total tracks: {len(tracklist)}")
        
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()