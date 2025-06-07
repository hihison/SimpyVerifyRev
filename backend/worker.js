var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin") {
      return await index_default.handleAdmin(url, env);
    } else if (url.pathname === "/message") {
      return await index_default.handleMessage(url, env);
    } else {
      return new Response("Not Found", { status: 404 });
    }
  },

  async handleMessage(url, env) {
    try {
      const encryptedMessage = url.searchParams.get("message");
      if (!encryptedMessage) {
        return new Response("Missing message parameter", { status: 400 });
      }

      const privateKeyPEM = env.PRIVATE_KEY; 
      if (!privateKeyPEM) {
        throw new Error("PRIVATE_KEY Not set in variable！");
      }

      const decryptedJSON = await index_default.decryptRSA(encryptedMessage, privateKeyPEM);
      const data = JSON.parse(decryptedJSON);


    // Generate a unique random token for randkey
    let randkey;
    do {
      randkey = crypto.randomUUID(); // Generate a UUID-based token
      var existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM messages WHERE randkey = ?")
        .bind(randkey)
        .first();
    } while (existing.count > 0); // Ensure uniqueness

      // Insert 
      await env.DB.prepare(
        "INSERT INTO messages (ip, hwid, dcid, regdate, hwserial, machineguid, country, version,randkey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(data.ip, data.hwid, data.dcid, data.regdate, data.hwserial, data.machineguid, data.country, data.version,randkey).run();

      return new Response(JSON.stringify({ message: "Data stored successfully", randkey }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response("Decryption or DB error: " + error.message, { status: 500 });
    }
  },

  async handleAdmin(url, env) {
    const adminId = url.searchParams.get("id");
    const password = url.searchParams.get("password");
    if (!adminId || !password) {
      return new Response("Missing credentials", { status: 400 });
    }

    const adminQuery = await env.DB.prepare(
      "SELECT * FROM admins WHERE id = ?"
    ).bind(adminId).first();

    if (!adminQuery || adminQuery.password !== password) {
      return new Response("Unauthorized", { status: 403 });
    }

    const messages = await env.DB.prepare("SELECT * FROM messages").all();
    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  },

  async decryptRSA(encrypted, privateKeyPEM) {
    try {
      if (!encrypted || typeof encrypted !== "string") {
        throw new Error("Invalid input");
      }

      let decodedMessage = decodeURIComponent(encrypted);
      let base64 = decodedMessage.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4 !== 0) {
        base64 += "=";
      }

      let binaryString = atob(base64);
      const encryptedBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedBuffer[i] = binaryString.charCodeAt(i);
      }

      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        index_default.pemToArrayBuffer(privateKeyPEM),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedBuffer);
      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      throw new Error("RSA Decrypt Fail：" + error.message);
    }
  },

  pemToArrayBuffer(pem) {
    const b64Lines = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
    const binaryString = atob(b64Lines);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
};

export { index_default as default };
