'use strict';
const AWS = require('aws-sdk');

const ses = new AWS.SES({ region: 'us-east-1' });

async function sendMailWithoutAttachment({ fromEmail, toEmail, html, subject }) {
  console.info({
    fromEmail,
    toEmail,
    html,
    subject,
  });
  try {
    const boundary = `----=_Part${Math.random().toString().substr(2)}`; // NOSONAR
    const rawMessage = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`, // For sending both plaintext & html content
      '\n',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '\n',
      html,
      // `--${boundary}`,
      // `Content-Type: ${attachmentType}; charset=utf-8`,
      // `Content-Disposition: attachment; filename = ${attachmentFilename}`,
      // '\n',
      // attachment,
      // '\n',
      `--${boundary}--`,
    ];
    const params = {
      Destinations: [...toEmail],
      RawMessage: { Data: rawMessage.join('\n') },
    };
    return await ses.sendRawEmail(params).promise();
  } catch (error) {
    console.info('error', error);
    throw error;
  }
}

module.exports = {
  sendMailWithoutAttachment,
};
