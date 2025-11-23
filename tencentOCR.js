class TencentOCR {
  constructor(secretId, secretKey, region = 'ap-guangzhou') {
    if (!secretId || !secretKey) throw new Error('缺少密钥');
    this.secretId = secretId;
    this.secretKey = secretKey;
    this.region = region;
    this.endpoint = 'ocr.tencentcloudapi.com';
  }

  async recognizeText(imageBase64) {
    const params = {
      ImageBase64: imageBase64,
      LanguageType: 'zh',
    };
    const res = await this.request('GeneralBasicOCR', params);
    if (res.Response.Error) throw new Error(res.Response.Error.Message);
    return res.Response.TextDetections.map((item) => item.DetectedText).join(
      '\n'
    );
  }

  async request(action, params) {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];

    const payload = JSON.stringify(params);
    const canonicalRequest = `POST\n/\n\ncontent-type:application/json\nhost:${
      this.endpoint
    }\n\ncontent-type;host\n${await this.sha256(payload)}`;
    const credentialScope = `${date}/ocr/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${await this.sha256(
      canonicalRequest
    )}`;

    const secretDate = await this.hmac(`TC3${this.secretKey}`, date);
    const secretService = await this.hmac(secretDate, 'ocr');
    const secretSigning = await this.hmac(secretService, 'tc3_request');
    const signature = await this.hmac(secretSigning, stringToSign, true);

    const authorization = `TC3-HMAC-SHA256 Credential=${this.secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

    const res = await fetch(`https://${this.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: this.endpoint,
        'X-TC-Action': action,
        'X-TC-Version': '2018-11-19',
        'X-TC-Timestamp': timestamp,
        'X-TC-Region': this.region,
        Authorization: authorization,
      },
      body: payload,
    });

    return await res.json();
  }

  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hmac(key, message, hex = false) {
    const keyBuffer =
      typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const msgBuffer = new TextEncoder().encode(message);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
    return hex
      ? Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : signature;
  }
}
