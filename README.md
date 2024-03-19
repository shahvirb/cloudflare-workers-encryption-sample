A sample app to play around with **Cloudflare Workers**. I also use **KV storage** as well as the **Cloudflare Web Crypto API**.

In this app we are demonstrating AES GCM encryption. You can encrypt a string with 256 bit AES GCM and get back some encrypted data as a JSON object.
This JSON object can then be transmitted insecurely for example such as sending this as text string to a friend, and then decrypted by them to retrieve the plain text message.
During this insecure transmission the AES GCM private key is never revealed or transmitted however. This is stored in Cloudflare KV storage. With the encrypted data alone you cannot decrypt the data, only this app can do so.

# Try It!
I've encrypted a message for you. Try to decrypt it!
Open the [decryption form](https://secrets-locker.shahvirb.workers.dev/ui/dec) and paste in this text below into the "JSON secret" form. You should see my hello world message.
```
{"iv":"07b31b4dfcf79c89703f4a62","encrypted":"a5a8c820c46fbb247a54109c13a919451447470df682317bd364d19c317b277f6a2db847c888572bbe395f8e433586aca6ae9b46cbce120a63b8f23f57f94d56d10e11b86958a5418c2e38fc7aff839515e6002b962dbe83f33e4c42058767dcddf6388eae09584e89c7d03c280abffbc486af45f863a682ca31aec2d9d17ea313ea8a6f3c522519"}
```

Want to encrypt your own string? [Try it here.](https://secrets-locker.shahvirb.workers.dev/ui/enc)

There are also two endpoints ```/enc``` and ```/dec``` you can POST to. Read my code to learn how those work.

As well there's a [test endpoint](https://secrets-locker.shahvirb.workers.dev/test) which encrypts a hardcoded string and then immediately decrypts it. This was mostly for my own testing and development purpose. 

# Cryptography and KV storage
256-bit AES GCM encryption is used with the [Cloudflare Web Crypto API.](https://developers.cloudflare.com/workers/runtime-apis/web-crypto)
The basic premise here is that the users text is encrypted by first generating a private AES-GCM key and then also generating an initialization vector which are some random integer values. This private key is super secret and we should never expose this. I think of the initialization vector (iv) as a public key.

When we encrypt the AES GCM algorithm uses the private key and iv to encrypt your data.

[KV storage](https://developers.cloudflare.com/kv/) is used to store the private key in our app backend. This structure is
```
  key: iv -- the randomly generated initialization vector.
  value: private AES-GCM key which was also generated
```

After encryption the user is returned their iv and their encrypted text as a JSON object. For example
```
{"iv":"07b31b4dfcf79c89703f4a62","encrypted":"a5a8c820c46fbb247a54109c13a919451447470df682317bd364d19c317b277f6a2db847c888572bbe395f8e433586aca6ae9b46cbce120a63b8f23f57f94d56d10e11b86958a5418c2e38fc7aff839515e6002b962dbe83f33e4c42058767dcddf6388eae09584e89c7d03c280abffbc486af45f863a682ca31aec2d9d17ea313ea8a6f3c522519"}
```

Together these two pieces must be supplied at decryption time. If either are compromised we can never reconstruct the message.

When the ```/dec``` endpoint recieves a POST request such as the JSON object above we retrieve using the KV storage explained above the private AES-GCM key. This is a matter of supplying the iv as the key, to fetch the value which is our private key. I apologize in advance for overloading the use of "key" both in public and private key contexts as well as for KV storage.

Now with the user supplied iv (public key), we have retrieved the private key from KV storage and can run a decryption algorithm with the user supplied encrypted text to decrypt the message.

I don't clean up any KV storage so you can keep on retrieiving the same encrypted message repeatedly until you exhaust the free limits of my cloudflare workers dev account :)
Note as well that if the KV storage is compromised or all data is erased we can never decrypt messages previously encrypted. You always need three pieces of data to decrypt a message, the private key (stored in the app backend), the iv (public key) supplied to the user, and the encrypted data, also supplied to the user.