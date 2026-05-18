const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

// ⬇️ 여기에 클라이언트 ID와 시크릿 값을 직접 넣으셔도 되고, .env.local 파일에 설정하셔도 됩니다.
// (우선순위: .env.local 파일의 값 -> 아래에 직접 적은 값)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || '여기에_구글_클라이언트_ID를_붙여넣으세요';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || '여기에_구글_클라이언트_시크릿을_붙여넣으세요';

// Note: You must add exactly this URI to your "Authorized Redirect URIs" in Google Cloud Console Credentials page
const REDIRECT_URI = 'http://127.0.0.1:3000/oauth2callback'; 

const SCOPE = 'https://www.googleapis.com/auth/adwords';

async function run() {
    console.log('=== Google Ads API Refresh Token Generator (Node.js) ===\n');
    
    if (CLIENT_ID.includes('YOUR_CLIENT_ID_HERE') || CLIENT_ID === '') {
        console.warn('⚠️ WARNING: GOOGLE_CLIENT_ID is not set in .env.local or is invalid.');
        console.warn('Please update .env.local with your real Google Client ID and Secret before proceeding.\n');
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent`;

    console.log('1. Go to the following URL in your browser:');
    console.log('\n' + authUrl + '\n');
    console.log('2. Log in and authorize the application.');
    console.log('3. You will be redirected to a URL starting with ' + REDIRECT_URI);
    console.log('4. Copy the "code" parameter from that URL.');
    console.log('   (e.g., http://127.0.0.1:3000/oauth2callback?code=4/0AX4Xf...&scope=...)');
    console.log('   Make sure to copy ONLY the code value, excluding "&scope=..." and any other parameters.\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Paste the authorization code here: ', async (code) => {
        rl.close();
        
        let cleanCode = code.trim();
        // Just in case the user pasted the entire URL by mistake, try to extract the code
        if (cleanCode.startsWith('http')) {
            try {
                const url = new URL(cleanCode);
                cleanCode = url.searchParams.get('code') || cleanCode;
            } catch (e) {
                // ignore
            }
        }

        if (!cleanCode || cleanCode === '') {
            console.error('Code cannot be empty!');
            return;
        }

        try {
            console.log('\nExchanging code for tokens...');
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    code: decodeURIComponent(cleanCode),
                    grant_type: 'authorization_code',
                    redirect_uri: REDIRECT_URI,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('\n❌ Failed to get token:', data);
                console.error('Make sure your Client ID, Secret, and Redirect URI are correct, and the code has not expired (codes expire after a few minutes).');
                return;
            }

            console.log('\n✅ Success!\n');
            console.log('--------------------------------------------------');
            console.log('Access Token:', data.access_token);
            console.log('Refresh Token:', data.refresh_token);
            console.log('Expires In:', data.expires_in, 'seconds');
            console.log('--------------------------------------------------');
            console.log('\nSave the Refresh Token securely (e.g., in your .env.local file or Database)!');

        } catch (error) {
            console.error('\n❌ Network error occurred:', error.message);
        }
    });
}

run();
