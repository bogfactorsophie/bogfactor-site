document.addEventListener('DOMContentLoaded', function () {
    const images = [];
    const image_files = ['/assets/sun_image.png', '/assets/neolithic-towie-ball.webp', '/assets/beastie.png'];
    const trailLength = image_files.length; // Number of points to keep in the trail
    const updateInterval = 50; // Update interval in milliseconds
    let mouseTrail = [];
    let isMoving = false;
    let lastMousePos = { x: 0, y: 0 };
    let lastButOneMousePos = { x: 0, y: 0 };

    // Create images using a loop
    for (let i = 0; i < image_files.length; i++) {
        const img = document.createElement('img');
        img.src = image_files[i];
        img.className = 'cursor-image';
        img.alt = 'Cursor Follower';
        img.style.position = 'absolute';
        img.style.display = 'none';
        document.body.appendChild(img);
        images.push(img);
    }

    // Handle mouse movement as it moves around the page
    document.addEventListener('mousemove', function (e) {
        lastButOneMousePos = lastMousePos;
        lastMousePos = { x: e.pageX, y: e.pageY };
        mouseTrail.push({ x: e.pageX, y: e.pageY });
        if (mouseTrail.length > trailLength) {
            mouseTrail.shift();
        }
        for (let img of images) {
            img.style.display = 'block';
        }
        if (!isMoving) {
            isMoving = true;
            animate();
        }
    });

    document.addEventListener('mouseleave', function () {
        for (let img of images) {
            img.style.display = 'none';
        }
    });

    document.addEventListener('mouseenter', function () {
        for (let img of images) {
            img.style.display = 'block';
        }
    });

    window.setInterval(function(){ // Set interval for checking
        animate();
    }, updateInterval);

    // Update image positions on scroll to follow the last mouse position
    window.addEventListener('scroll', function () {
        if (mouseTrail.length > 0) {
            for (let i = 0; i < images.length; i++) {
                let trailIndex = Math.max(0, mouseTrail.length - 1 - (i * Math.floor(trailLength / images.length)));
                let pos = mouseTrail[trailIndex];
                images[i].style.left = pos.x + 'px';
                images[i].style.top = pos.y + 'px';
            }
        }

        animate()
    });

    function animate() {
        // If no trail, nothing to animate
        if (mouseTrail.length === 0) {
            isMoving = false;
            return;
        }

        // Each image follows a delayed point in the trail
        for (let i = 0; i < images.length; i++) {
            // The further back in the array, the further behind in the trail
            let trailIndex = Math.max(0, mouseTrail.length - 1 - (i * Math.floor(trailLength / images.length)));
            let pos = mouseTrail[trailIndex];

            // add an element drifting towards the current mouse position
            pos.x += (lastMousePos.x - pos.x) * 0.005;
            pos.y += (lastMousePos.y - pos.y) * 0.005;

            images[i].style.left = pos.x + 'px';
            images[i].style.top = pos.y + 'px';
        }
        
        // If the mouse hasn't moved yet, gradually let the trail settle on the last position
        if (mouseTrail.length < trailLength) {
            // Not enough points yet, keep animating
            requestAnimationFrame(animate);
        } else {
            // Remove the oldest point to let the images catch up to the last mouse position
            mouseTrail.shift();
            requestAnimationFrame(animate);
        }

        // If the mouse has stopped, clear the trail
        if (lastMousePos.x === lastButOneMousePos.x && lastMousePos.y === lastButOneMousePos.y) {
            if (mouseTrail.length > 0) {
                mouseTrail.shift();
                requestAnimationFrame(animate);
            } else {
                isMoving = false;
            }
        }
    }
});

