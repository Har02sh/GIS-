document.addEventListener('DOMContentLoaded', function () {

    // --- DOM Element References ---
    const groupSelect = document.getElementById('group-select');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const showPathBtn = document.getElementById('show-path-btn');
    const timelineUl = document.getElementById('timeline');
    const popupContainer = document.getElementById('popup');
    const popupContent = document.getElementById('popup-content');
    const popupCloser = document.getElementById('popup-closer');

    // --- State Variables ---
    let animationInterval = null; // To hold the interval ID

    // --- Map Initialization ---
    const popupOverlay = new ol.Overlay({
        element: popupContainer,
        autoPan: true,
        autoPanAnimation: {
            duration: 250,
        },
    });

    const map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([77.2090, 28.6139]), // Centered on Delhi
            zoom: 6 // Slightly more zoomed in for a better initial view
        }),
        overlays: [popupOverlay],
    });

    const vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
    });
    map.addLayer(vectorLayer);


    // --- Event Listeners ---
    showPathBtn.addEventListener('click', fetchAndDisplayPath);
    
    popupCloser.onclick = function () {
        popupOverlay.setPosition(undefined);
        popupCloser.blur();
        return false;
    };

    map.on('click', function (evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
            return feature;
        });
        if (feature && feature.get('type') === 'point') {
            const coordinates = feature.getGeometry().getCoordinates();
            popupOverlay.setPosition(coordinates);
            popupContent.innerHTML = `<p>Timestamp:</p><code>${feature.get('timestamp')}</code>`;
        } else {
            popupOverlay.setPosition(undefined);
            popupCloser.blur();
        }
    });


    // --- Functions ---
    /**
     * Fetches location data from the backend and starts the animation.
     */
    async function fetchAndDisplayPath() {
        // Stop any ongoing animation
        if (animationInterval) {
            clearInterval(animationInterval);
        }

        // Clear previous data from the map and timeline
        vectorSource.clear();
        timelineUl.innerHTML = '';
        
        const groupId = groupSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!groupId || !startDate || !endDate) {
            alert('Please select a group and a date range.');
            return;
        }

        try {
            const response = await fetch(`/api/locations?group_id=${groupId}&start_date=${startDate}&end_date=${endDate}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const locations = await response.json();
            if (locations.length === 0) {
                alert('No data available for the selected criteria.');
                return;
            }
            animatePath(locations);
        } catch (error) {
            console.error('Error fetching location data:', error);
            alert('Failed to fetch location data.');
        }
    }

    /**
     * Animates the path on the map, showing points and segments one by one.
     * @param {Array} locations - Array of location objects.
     */
    function animatePath(locations) {
        let i = 0;
        const allCoordinates = []; // To hold all coordinates for the animation

        animationInterval = setInterval(() => {
            if (i >= locations.length) {
                clearInterval(animationInterval);
                // Fit map to the final path once the animation is complete
                if (vectorSource.getFeatures().length > 0) {
                    map.getView().fit(vectorSource.getExtent(), { padding: [50, 50, 50, 50], duration: 1000 });
                }
                return;
            }

            const loc = locations[i];
            const lonLat = [loc.longitude, loc.latitude];
            const transformedCoord = ol.proj.fromLonLat(lonLat);
            allCoordinates.push(transformedCoord);

            // 1. Add the point feature for the current location
            const pointFeature = new ol.Feature({
                geometry: new ol.geom.Point(transformedCoord),
                timestamp: loc.timestamp,
                type: 'point'
            });
            pointFeature.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({ color: '#E53935' }), // Red fill for the point
                    stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) // White border
                })
            }));
            vectorSource.addFeature(pointFeature);

            // 2. Add the corresponding timestamp to the timeline
            const timelineItem = document.createElement('li');
            timelineItem.textContent = `Location at: ${loc.timestamp}`;
            timelineUl.appendChild(timelineItem);
            timelineUl.scrollTop = timelineUl.scrollHeight; // Auto-scroll to the latest item

            // 3. Create a line segment feature with an arrow if it's not the first point
            if (i > 0) {
                const prevCoord = allCoordinates[i - 1];
                const segmentGeom = new ol.geom.LineString([prevCoord, transformedCoord]);
                const segmentFeature = new ol.Feature({
                    geometry: segmentGeom,
                    type: 'path-segment'
                });
                segmentFeature.setStyle(createSegmentStyle(segmentGeom));
                vectorSource.addFeature(segmentFeature);
            }

            // 4. Animate the view to center on the new point
            map.getView().animate({
                center: transformedCoord,
                duration: 1000, // Smoothly pan over 0.5 seconds
                zoom: map.getView().getZoom() // Keep current zoom level
            });

            i++;
        }, 2000); // 1000ms = 1-second interval
    }

    /**
     * Creates a style for a single line segment with a dotted line and a direction arrow at its midpoint.
     * @param {ol.geom.LineString} geometry - The geometry of the line segment.
     * @returns {Array<ol.style.Style>} An array of styles for the line and arrow.
     */
    function createSegmentStyle(geometry) {
        const styles = [
            // Style for the dotted line
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#007bff',
                    width: 2,
                    lineDash: [20, 5], // [line, space] pattern for the dotted effect
                }),
            }),
        ];

        // Calculate rotation and midpoint for the arrow
        const coords = geometry.getCoordinates();
        const start = coords[0];
        const end = coords[1];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const rotation = Math.atan2(dy, dx);
        const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];

        // Style for the arrow icon, placed at the midpoint of the segment
        styles.push(
            new ol.style.Style({
                geometry: new ol.geom.Point(midpoint),
                image: new ol.style.Icon({
                    // Using an inline SVG for the arrow shape for better control
                    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23007bff"><path d="M12 2L2.5 20.5h19L12 2z"/></svg>',
                    anchor: [0.5, 0.5], // Anchor at the center of the icon
                    rotateWithView: true,
                    rotation: -rotation + Math.PI / 2, // Rotate the icon to match the line direction
                    scale: 0.6,
                }),
            })
        );

        return styles;
    }
});
