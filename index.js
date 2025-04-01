require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Email account configuration
const emailAccounts = [
  {
    user: process.env.GMAIL_USER1,
    pass: process.env.GMAIL_PASSWORD1
  },
  {
    user: process.env.GMAIL_USER2,
    pass: process.env.GMAIL_PASSWORD2
  }
];

// Create transporters for both accounts
const transporters = emailAccounts.map(account => ({
  transporter: nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: account.user,
      pass: account.pass
    }
  }),
  user: account.user
}));

let currentTransporterIndex = 0;

// Switch transporter every 60 minutes (60 * 60 * 1000 ms)
setInterval(() => {
  currentTransporterIndex = (currentTransporterIndex + 1) % transporters.length;
  console.log(`Switched to email account: ${transporters[currentTransporterIndex].user}`);
}, 60 * 60 * 1000);

// Email sending endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const currentTransporter = transporters[currentTransporterIndex];

    const mailOptions = {
      from: currentTransporter.user,
      to,
      subject,
      text
    };

    const info = await currentTransporter.transporter.sendMail(mailOptions);
    console.log(`Email sent using ${currentTransporter.user}:`, info.messageId);
    res.status(200).json({ message: 'Email sent successfully', info });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Initial email account: ${transporters[currentTransporterIndex].user}`);
});