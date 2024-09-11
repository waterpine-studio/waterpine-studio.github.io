function loadMarkdown(filePath, elementId) {
    fetch(filePath)
        .then(response => response.text())
        .then(markdown => {
            document.getElementById(elementId).innerHTML = marked.parse(markdown);
        })
        .catch(error => {
            console.error('Error loading Markdown file:', error);
        });
}

function displayDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const infoElement = document.getElementById('date-time-info');
    if (infoElement) {
        infoElement.innerHTML = `Date & Time: ${dateStr} | Time Zone: ${timeZone}`;
    }
}

function loadProject(url) {
    fetch(url)
        .then(response => response.text())
        .then(data => {
            // Inject the HTML content into the .main-content div
            const mainContent = document.querySelector('.main-content');
            mainContent.innerHTML = data;

            // Find and execute all script tags in the dynamically loaded content
            const scripts = mainContent.querySelectorAll('script');
            scripts.forEach(script => {                
                const newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = script.textContent;
                }
                document.body.appendChild(newScript);
            });
        })
        .catch(error => console.error('Error loading project:', error));
}
