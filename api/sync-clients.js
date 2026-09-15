/**
 * Vercel Serverless Function - GitHub Client DB Auto-Sync Proxy
 * Reads and commits updated clients.json directly to GitHub repository.
 * 
 * Repo: n00bcooD3R/stda-invoice_generator
 * Path: clients.json
 */

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const REPO_OWNER = 'n00bcooD3R';
    const REPO_NAME = 'stda-invoice_generator';
    const FILE_PATH = 'clients.json';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    const githubApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

    // GET METHOD: Fetch latest clients.json from GitHub
    if (req.method === 'GET') {
        try {
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (GITHUB_TOKEN) {
                headers['Authorization'] = `token ${GITHUB_TOKEN}`;
            }

            const response = await fetch(githubApiUrl, { headers });
            if (!response.ok) {
                return res.status(200).json({
                    success: false,
                    message: 'Could not fetch from GitHub API directly, using static fallback.',
                    hasToken: !!GITHUB_TOKEN
                });
            }

            const fileData = await response.json();
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const clients = JSON.parse(content);

            return res.status(200).json({
                success: true,
                clients: clients,
                sha: fileData.sha,
                hasToken: !!GITHUB_TOKEN
            });
        } catch (err) {
            return res.status(500).json({
                error: 'Error reading from GitHub: ' + err.message
            });
        }
    }

    // POST METHOD: Commit updated clients.json to GitHub
    if (req.method === 'POST') {
        if (!GITHUB_TOKEN) {
            return res.status(200).json({
                success: false,
                isMock: true,
                message: 'No GITHUB_TOKEN configured in Vercel environment variables. Saved to browser storage.'
            });
        }

        try {
            const { clients } = req.body || {};
            if (!Array.isArray(clients)) {
                return res.status(400).json({ error: 'Invalid client list payload' });
            }

            // 1. Get current SHA hash of clients.json
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${GITHUB_TOKEN}`
            };

            const getRes = await fetch(githubApiUrl, { headers });
            let sha = '';
            if (getRes.ok) {
                const getFileData = await getRes.json();
                sha = getFileData.sha;
            }

            // 2. Commit updated JSON content
            const updatedContent = JSON.stringify(clients, null, 4);
            const base64Content = Buffer.from(updatedContent).toString('base64');

            const putRes = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Auto-sync clients database (${clients.length} records)`,
                    content: base64Content,
                    sha: sha || undefined,
                    branch: 'main'
                })
            });

            if (putRes.ok) {
                const result = await putRes.json();
                return res.status(200).json({
                    success: true,
                    commit: result.commit?.sha || 'ok',
                    message: `Successfully synced ${clients.length} clients to GitHub!`
                });
            } else {
                const errData = await putRes.json();
                return res.status(putRes.status).json({
                    error: errData.message || 'GitHub commit failed'
                });
            }
        } catch (err) {
            return res.status(500).json({
                error: 'Server error committing to GitHub: ' + err.message
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
