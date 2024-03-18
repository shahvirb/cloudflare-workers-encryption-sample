export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/test": {
        try {
          // Encrypt and decrypt a test string
          // We should see on screen the plain text string after the e2e encryption/decryption.
          const text = 'If you can read this string then encryption/decryption must work. abcdef-123456';
          const keyName = "testEndpointKey";

          const { encryptedText, key, iv } = await encryptText(text);
          console.log("encryptedText: ", encryptedText);
          await storeKeyInKV(key, env.mykv, keyName);

          const readBackKey = await getKeyFromKV(env.mykv, keyName);

          const decryptedText = await decryptText(encryptedText, readBackKey, iv)
          return new Response(decryptedText, { status: 200 });

        } catch (error) {
          return new Response(error.message, { status: 500 });
        }
      }

      case "/enc": {
        const body = await request.text();
        const params = new URLSearchParams(body);
        const text = params.get('textToEncrypt');

        const { encryptedText, key, iv } = await encryptText(text);
        await storeKeyInKV(key, env.mykv, iv);

        const responseObject = {
          iv: toHexString(iv),
          encrypted: encryptedText
        };
        return new Response(JSON.stringify(responseObject), {
          // headers: { 'Content-Type': 'application/json' }
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      case "/ui/enc": {
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Encrypt Text</title>
            </head>
            <body>
              <h2>Encrypt Text</h2>
              <form action="/enc" method="post">
                <textarea name="textToEncrypt" rows="10" cols="30" placeholder="Enter text to encrypt..."></textarea>
                <br>
                <button type="submit">Encrypt Text</button>
              </form>
            </body>
            </html>
          `;

        return new Response(htmlContent, {
          headers: {
            'Content-Type': 'text/html'
          }
        });
      }

      case "/dec": {
        const body = await request.text(); // Read the body as text
        const params = new URLSearchParams(body); // Parse the URL-encoded string
        const jsonRaw = params.get('textToDecrypt'); // Extract the value

        console.log(jsonRaw);
        const { iv: ivHex, encrypted: encryptedText } = JSON.parse(jsonRaw);

        const iv = fromHexString(ivHex);
        const key = await getKeyFromKV(env.mykv, iv);
        const decryptedText = await decryptText(encryptedText, key, iv)

        return new Response(decryptedText);
      }

      case "/ui/dec": {
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Decrypt Secret</title>
            </head>
            <body>
              <h2>Decrypt Secret</h2>
              <form action="/dec" method="post">
                <textarea name="textToDecrypt" rows="10" cols="30" placeholder="Enter JSON secret here"></textarea>
                <br>
                <button type="submit">Decrypt Secret</button>
              </form>
            </body>
            </html>
          `;

        return new Response(htmlContent, {
          headers: {
            'Content-Type': 'text/html'
          }
        });
      }

      default: {
        return new Response("Not found", { status: 404 });
      }
    }
  },
};

function toHexString(byteArray) {
  return [...byteArray].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function fromHexString(hexString) {
  return new Uint8Array(hexString.match(/[\da-f]{2}/gi).map(byte => parseInt(byte, 16)));
}


async function encryptText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Whether the key is extractable
    ['encrypt', 'decrypt'] // Key usage
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // Convert the encrypted buffer to a hex string which can be viewed as text
  const buffer = new Uint8Array(encrypted);
  const encryptedText = toHexString(buffer);

  return { encryptedText, key, iv };
}

async function decryptText(encryptedText, key, iv) {
  const encryptedBuffer = fromHexString(encryptedText);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  const decryptedText = decoder.decode(decrypted);
  return decryptedText;
}


async function storeKeyInKV(key, kvNamespace, keyName) {
  const exportedKey = await crypto.subtle.exportKey("raw", key);
  const encodedKey = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  await kvNamespace.put(keyName, encodedKey);
}

async function getKeyFromKV(kvNamespace, keyName) {
  const encodedKey = await kvNamespace.get(keyName);
  const decodedKey = Uint8Array.from(atob(encodedKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    decodedKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
  return key;
}