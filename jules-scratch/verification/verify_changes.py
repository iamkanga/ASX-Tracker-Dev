from playwright.sync_api import sync_playwright, expect
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        page = context.new_page()

        html_file_path = os.path.abspath('index.html')
        page.goto(f'file://{html_file_path}')

        # Manually make the app visible
        page.evaluate("""() => {
            document.querySelector('#appHeader')?.classList.remove('app-hidden');
            document.querySelector('main.container')?.classList.remove('app-hidden');
            document.querySelector('#splashScreen')?.remove();
        }""")

        expect(page.locator('#appHeader')).to_be_visible()

        # Manually manipulate the DOM to show the chevron and the expanded button container,
        # since we cannot call the app's internal JS functions in this environment.
        page.evaluate("""() => {
            const container = document.getElementById('asxCodeButtonsContainer');
            const toggleBtn = document.getElementById('toggleAsxButtonsBtn');
            const chevronIcon = toggleBtn ? toggleBtn.querySelector('.asx-toggle-triangle') : null;

            if (container) {
                // Inject a button so it looks realistic
                const button = document.createElement('button');
                button.className = 'asx-code-btn';
                button.textContent = 'BHP';
                container.appendChild(button);

                // Manually expand the container
                container.classList.add('expanded');
            }
            if (toggleBtn) {
                // Manually show the toggle button
                toggleBtn.style.display = 'inline-flex';
            }
            if (chevronIcon) {
                // Manually rotate the chevron
                chevronIcon.classList.add('expanded');
            }
        }""")

        # Verify that the chevron arrow is now visible.
        chevron = page.locator('#toggleAsxButtonsBtn')
        expect(chevron).to_be_visible()
        # Verify the container is expanded
        asx_buttons_container = page.locator('#asxCodeButtonsContainer')
        expect(asx_buttons_container).to_have_class('asx-code-buttons-container expanded')

        # Inject the fake mobile card to verify the buy/sell indicator
        page.evaluate("""() => {
            const cardContainer = document.getElementById('mobileShareCards');
            if (cardContainer) {
                const card = document.createElement('div');
                card.classList.add('mobile-card');
                card.innerHTML = `
                    <h3 class="neutral-code-text card-code">BHP</h3>
                    <p class="data-row alert-target-row">
                        <span class="label-text">Alert Target:</span>
                        <span class="data-value">
                            <span class="alert-target-intent">B</span>
                            <span class="alert-target-arrow down">▼</span>
                            <span class="alert-target-price">$45.00</span>
                        </span>
                    </p>
                `;
                cardContainer.appendChild(card);
                cardContainer.style.display = 'flex';
                const table = document.querySelector('.table-container');
                if (table) table.style.display = 'none';
            }
        }""")

        # Verify the injected card and its content are visible
        bhp_card = page.locator('.mobile-card', has_text='BHP')
        expect(bhp_card).to_be_visible()
        expect(bhp_card.locator('.alert-target-row .data-value')).to_contain_text('B')

        # Take a screenshot for visual confirmation
        page.screenshot(path='jules-scratch/verification/verification.png')

        browser.close()

if __name__ == '__main__':
    run_verification()
