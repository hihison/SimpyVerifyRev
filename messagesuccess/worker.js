export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the frontend HTML
    if (url.pathname === '/') {
      return new Response(renderHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // API Endpoint to fetch user data
    if (url.pathname === '/data') {
      const { searchParams } = url;
      const randkey = searchParams.get('randkey');

      // Check if randkey exists and contains "-SUCCESS"
      if (!randkey || !randkey.includes('-SUCCESS')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid randkey' }), { status: 400 });
      }

      try {
        // Query the database for the user record
        const { results } = await env.DB.prepare(
          "SELECT regdate, dcid, hwserial, country, ip FROM messages WHERE randkey = ?"
        ).bind(randkey).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'No data found' }), { status: 404 });
        }

        let duplicateWarning = '';


        // Check for duplicate Discord IDs in the database
        const { results: dcResults } = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM messages WHERE dcid = ?"
        ).bind(results[0].dcid).all();

        if (dcResults[0].count > 1) {
          duplicateWarning += 'Glad to see you again, old user !\n';
        }

        // Fetch Discord user avatar
        const discordResponse = await fetch(`https://discord.com/api/users/${results[0].dcid}`, {
          headers: { "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}` }
        });

        if (!discordResponse.ok) {
          throw new Error('Failed to fetch Discord user data');
        }

        const discordData = await discordResponse.json();
        const avatarUrl = discordData.avatar 
          ? `https://cdn.discordapp.com/avatars/${results[0].dcid}/${discordData.avatar}.png` 
          : 'https://cdn.discordapp.com/embed/avatars/0.png';

        // Return JSON response
        return new Response(JSON.stringify({ 
          ...results[0], 
          avatar: avatarUrl, 
          warning: duplicateWarning.trim() // Remove extra newline at end
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: 'Database or API error', details: error.message }), { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

// Function to render the Vue.js frontend
function renderHTML() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Linked</title>
    <script src="https://cdn.jsdelivr.net/npm/vue@3"></script>
    <style>
      body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4; }
      .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); max-width: 400px; margin: auto; margin-top: 50px; }
      .success { color: green; font-size: 22px; font-weight: bold; margin-top: 10px; }
      .warning { color: red; font-size: 18px; font-weight: bold; margin-top: 10px; white-space: pre-line; }
      img { width: 80px; height: 80px; margin-bottom: 10px; border-radius: 50%; }
      .info { text-align: left; margin-top: 15px; }
      .info p { margin: 5px 0; font-size: 16px; }
      .avatar-img {
        width: 80px;
        height: 80px;
        margin-bottom: 10px;
        border-radius: 50%;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        cursor: pointer;
      }
      
      .avatar-img:hover {
        transform: scale(1.1) rotate(3deg);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="container" v-if="data">
      <img :src="data.avatar" alt="Discord Avatar" class="avatar-img" />

        <p v-if="data.warning" class="warning" v-html="data.warning.replace(/\\n/g, '<br>')"></p>
        <p v-if="data && !data.warning" class="success">Message is here!</p>
        <div v-if="data" class="info">
          <p><strong>📅 Message Date:</strong> {{ data.regdate }}</p>
          <p><strong>🆔 Discord ID:</strong> {{ maskedDcid }}</p>
          <p><strong>🔧 Message:</strong> {{ data.hwserial }}</p>
          <p><strong>🌍 Country:</strong> {{ countryOnly }}</p>
        </div>
      </div>
      <p v-else>Loading...</p>
    </div>
    <script>

    const app = Vue.createApp({
      data() {
        return { data: null };
      },
      computed: {
        maskedDcid() {
          const dcid = this.data?.dcid || '';
          if (dcid.length <= 4) return dcid;
          return '*'.repeat(dcid.length - 4) + dcid.slice(-4);
        },
        countryOnly() {
          if (!this.data || typeof this.data.country !== 'string') return '';
          return this.data.country.split('//')[0].trim();
        }
      },
      mounted() {
        const params = new URLSearchParams(window.location.search);
        const randkey = params.get('randkey');
        if (!randkey) return;
        fetch('/data?randkey=' + randkey)
          .then(response => response.json())
          .then(json => {
            if (!json.error) {
              this.data = json;
            }
          });
      }
    });
    app.mount('#app');
    </script>
  </body>
  </html>`;
}
