import express from "express";
import puppeteer from 'puppeteer';

const app = express();
const PORT = 8080;
app.use(express.json());

let activeUsers = []; // [{name, email, addedAt, timer}]



const cookies = [
    {
        "name": "sp_dc",
        "value": "AQA_jet_rcYstKa08hZbO5hNtg7Z9mdPWRzg9YaN7_kPHx5RA94QyPlJI__0GBFSLeI2JI57kWCfSWbefWCV3PILBapjYDamizBxc8xOH8kI5JJJ25zqL6XDyTMf4Dg6zZiikovFt6AW0TAY70uEOhyj3QPMWSP9UGPB_eDZ61KGVjf20Fe2rtEc1uATHjXDgr2bKdjl6lnMIEY171A",
        "domain": ".spotify.com",
        "path": "/",
    },
    {
        "name": "sp_key",
        "value": "8cac2819-7d04-4b15-b130-b49e04094ebf",
        "domain": ".spotify.com",
        "path": "/",
    },
    {
        "name": "sp_t",
        "value": "76ccdb04724a267029f4a9e968b7aec1",
        "domain": ".spotify.com",
        "path": "/",
    }
];


app.get("/add-user", async (req, res) => {
    const { name, email } = req.query;
    if (!name || !email) return res.status(400).json({ error: "Missing params" });

    // Remove oldest user if limit exceeded
    if (activeUsers.length >= 25) {
        const oldest = activeUsers.shift();
        try { await removeUser(oldest); } catch (e) { console.error(e); }
        clearTimeout(oldest.timer);
    }

    // Add new user via Puppeteer
    try {
        await addUser({ name, email });

        // Set timer for removal after 10 minutes
        const timer = setTimeout(async () => {
            await removeUser({ email });
            activeUsers = activeUsers.filter(u => u.email !== email);
        }, 10 * 60 * 1000);

        activeUsers.push({ name, email, addedAt: Date.now(), timer });

        return res.json({ success: true, message: "User added for 10 minutes" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});



let browser, page;

async function initPuppeteer() {
    browser = await puppeteer.launch({
        headless: true, // Must be true for app hosting
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });
    page = await browser.newPage();
    await browser.setCookie(...cookies); // Your cookie array
}
await initPuppeteer();

const addUser = async (user) => {
    await page.goto('https://developer.spotify.com/dashboard/227bd6d0dd3f447d877ae28b5e9f36e1/users');
    await page.setViewport({ width: 1080, height: 1024 });
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.type('input[name="name"]', user.name);
    await page.type('input[name="email"]', user.email);
    await page.click('button[type="submit"]');
    // Wait for some confirmation if possible
};

const removeUser = async (user) => {
    await page.goto('https://developer.spotify.com/dashboard/227bd6d0dd3f447d877ae28b5e9f36e1/users');
    await page.setViewport({ width: 1080, height: 1024 });
    await page.waitForSelector('table', { timeout: 10000 });

    const rows = await page.$$('tr');
    for (let i = 0; i < rows.length; i++) {
        const emailCell = await rows[i].$('td:nth-child(3)');
        if (emailCell) {
            const emailText = await page.evaluate(el => el.textContent.trim(), emailCell);
            if (emailText === user.email) {
                // Remove logic as per your code
                await page.evaluate(idx => {
                    document.querySelectorAll('button[aria-label="User options"]')[idx - 1]?.click();
                    setTimeout(() => {
                        document.querySelectorAll('[data-encore-id="popoverNavigationLink"]')[0]?.click();
                    }, 1000);
                }, i);
                break;
            }
        }
    }
};


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
