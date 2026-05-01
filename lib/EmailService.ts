import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_SECRET);

export interface SendTrackingData {
    customerName: string;
    orderNumber: string;
    trackingLink: string;
    carrierName: string;
    estimatedDelivery: string;
}

export class EmailService {
    async sendOrderTracking(to: string, data: SendTrackingData): Promise<boolean> {
        try {
            const subject = `Your MEMOÍ Order #${data.orderNumber} is on its way`;

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Track your MEMOÍ Order</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f9f9f9; margin: 0; padding: 0; }
    .email-wrapper { width: 100%; background-color: #f9f9f9; padding: 40px 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .logo-container { text-align: center; margin-bottom: 30px; }
    .logo-container img { max-width: 150px; height: auto; }
    .content p { font-size: 15px; margin-bottom: 15px; }
    .button-container { text-align: center; margin: 30px 0; }
    .tracking-button { background-color: #111111; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 4px; display: inline-block; text-transform: uppercase; letter-spacing: 1px; }
    .info-box { background-color: #f4f4f4; border-radius: 6px; padding: 20px; margin: 25px 0; }
    .info-box h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #111111; text-transform: uppercase; letter-spacing: 1px; }
    .info-box p { margin: 5px 0; font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; }
    .footer-links a { color: #666666; text-decoration: none; font-size: 13px; margin: 0 10px; font-weight: bold; }
    .footer-links a:hover { color: #111111; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      
      <div class="logo-container">
        <img src="https://d380qwdachaae3.cloudfront.net/MEMOILOGO.png" alt="MEMOÍ Logo">
      </div>

      <div class="content">
        <p>Dear ${data.customerName},</p>
        <p>We are pleased to inform you that your curated selection from MEMOÍ has been meticulously inspected, beautifully packaged, and is now on its journey to you.</p>
        <p>At MEMOÍ we believe the journey is as important as the destination. To follow the progress of your order as it makes its way to your doorstep, please use the link below:</p>
        
        <div class="button-container">
          <a href="${data.trackingLink}" class="tracking-button">Track Your Journey</a>
        </div>

        <div class="info-box">
          <h3>Shipping Details</h3>
          <p><strong>Order Number:</strong> #${data.orderNumber}</p>
          <p><strong>Carrier:</strong> ${data.carrierName}</p>
          <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
        </div>
        
        <p>Should you require any assistance or have a special request, our team remains at your service. We look forward to this piece becoming part of your story.</p>
        
        <p>Warm regards,<br><strong>The MEMOÍ Team</strong></p>
      </div>

      <div class="footer">
        <div class="footer-links">
          <a href="https://memoiofficial.com/">Website</a> |
          <a href="https://www.instagram.com/memoi.official/">Instagram</a> |
          <a href="https://www.facebook.com/memoi.official">Facebook</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
            `;

            await resend.emails.send({
                from: process.env.EMAIL_FROM_ADDRESS || 'MEMOÍ <orders@memoiofficial.com>',
                to: to,
                subject: subject,
                html: html,
            });

            return true;
        } catch (error) {
            console.error('Tracking email failed:', error);
            return false;
        }
    }
}