import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of Twilio
let twilioClient: any = null;
const getTwilio = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn("Twilio credentials missing. Logging SMS to console instead.");
    return null;
  }
  if (!twilioClient) {
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for simulating a missed call
  app.post("/api/missed-call", async (req, res) => {
    const { customerNumber, businessNumber, message } = req.body;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || businessNumber;
    
    console.log(`Processing missed call from ${customerNumber} to ${fromNumber}`);
    
    const client = getTwilio();
    let smsStatus = "logged";

    if (client) {
      try {
        await client.messages.create({
          body: message || "Hey, you missed a call. What can I do for you?",
          from: fromNumber,
          to: customerNumber
        });
        smsStatus = "sent";
        console.log(`Real SMS sent to ${customerNumber}`);
      } catch (error) {
        console.error("Twilio Error:", error);
        smsStatus = "failed";
      }
    } else {
      console.log(`[SIMULATION] Sending SMS to ${customerNumber}: ${message}`);
    }
    
    res.json({ 
      success: smsStatus === "sent", 
      status: smsStatus,
      message: smsStatus === "sent" ? "Real SMS sent!" : "SMS logged to console (check server logs)."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
