import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";
import { initializeApp as initClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection, addDoc, getDocs, doc, updateDoc, serverTimestamp, query, where, limit } from "firebase/firestore";
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK for backend (acts as pseudo-admin due to relaxed rules)
const app = initClientApp(firebaseConfig);
const clientDb = getClientFirestore(app, firebaseConfig.firestoreDatabaseId);

export const FieldValue = {
  serverTimestamp: serverTimestamp
};

// Mock admin DB to avoid rewriting the entire server logic
export const db: any = {
  collection: (pathStr: string) => {
    return {
      get: async () => {
        const snap = await getDocs(collection(clientDb, pathStr));
        return {
          empty: snap.empty,
          size: snap.size,
          docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() }))
        };
      },
      add: async (data: any) => {
        const ref = await addDoc(collection(clientDb, pathStr), data);
        return { id: ref.id };
      },
      where: (field: string, op: any, val: any) => {
        return {
           limit: (num: number) => {
             return {
                get: async () => {
                   const snap = await getDocs(query(collection(clientDb, pathStr), where(field, op, val), limit(num)));
                   return {
                      empty: snap.empty,
                      size: snap.size,
                      docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() }))
                   }
                }
             }
           }
        }
      },
      doc: (docId: string) => {
        return {
          update: async (data: any) => {
            await updateDoc(doc(clientDb, pathStr, docId), data);
          },
          collection: (subPath: string) => {
             return db.collection(`${pathStr}/${docId}/${subPath}`);
          }
        }
      },
      limit: (num: number) => {
        return {
            get: async () => {
                const snap = await getDocs(query(collection(clientDb, pathStr), limit(num)));
                return {
                  empty: snap.empty,
                  size: snap.size,
                  docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() }))
                };
            }
        }
      }
    };
  }
};

console.log(`[FIREBASE] Initialized with Database ID: ${firebaseConfig.firestoreDatabaseId}`);

// Verify DB connection on startup
(async () => {
  try {
    const snap = await db.collection("settings").limit(1).get();
    console.log(`[FIREBASE] Health Check: Connection successful. Found settings count: ${snap.size}`);
  } catch (err: any) {
    console.error(`[FIREBASE ERROR] Health Check Failed: ${err.message}`);
  }
})();

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
  app.use(express.urlencoded({ extended: true }));

  // API Route for simulating a missed call
  app.post("/api/missed-call", async (req, res) => {
    const { customerNumber, businessNumber, message, channel } = req.body;
    // Clean numbers: remove spaces, parentheses, etc. but keep the +
    const cleanNumber = (num: string) => {
      const cleaned = num.replace(/[^\d+]/g, "");
      // If it doesn't start with +, and it's 10-11 digits, assume it needs a +
      if (!cleaned.startsWith("+") && cleaned.length >= 10) {
        return `+${cleaned}`;
      }
      return cleaned;
    };

    // Smart number selection: Prefer the provided business number if it matches a typical phone format
    // Otherwise fallback to the registered environment secret
    let fromNumber = businessNumber || process.env.TWILIO_PHONE_NUMBER;
    
    // Safety: ensure we have a number
    if (!fromNumber) {
      return res.status(400).json({ 
        success: false, 
        error: "No sender number found. Please set your Twilio Phone Number in the app settings or environment secrets."
      });
    }

    fromNumber = cleanNumber(fromNumber);
    let toNumber = cleanNumber(customerNumber);

    if (channel === 'whatsapp') {
      fromNumber = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
      toNumber = toNumber.startsWith("whatsapp:") ? toNumber : `whatsapp:${toNumber}`;
    }
    
    console.log(`TWILIO DEBUG: Attempting ${channel} from [${fromNumber}] to [${toNumber}]`);
    
    const client = getTwilio();
    let status = "logged";

    if (client) {
      try {
        const result = await client.messages.create({
          body: message || "Hey, you missed a call. What can I do for you?",
          from: fromNumber,
          to: toNumber
        });
        status = "sent";
        console.log(`Success! ${channel} message sent. SID: ${result.sid}`);
      } catch (error: any) {
        console.error("Twilio Error Detail:", {
          code: error.code,
          message: error.message,
          moreInfo: error.moreInfo,
          channel,
          from: fromNumber,
          to: toNumber
        });
        let suggestion = "Check your Twilio settings.";
        if (error.code === 21608) {
          suggestion = "This number is not verified. If using WhatsApp sandbox, make sure you joined it first.";
        } else if (error.code === 63007) {
          suggestion = "The WhatsApp session is closed. You must send a message (like 'Hi') from your phone to the Twilio number first to open the 24-hour window.";
        }

        return res.status(500).json({ 
          success: false, 
          error: error.message,
          suggestion: suggestion
        });
      }
    }
    
    res.json({ success: status === "sent", status });
  });

  // --- 3. REPLY WEBHOOK (For Processing Ratings) ---
  app.all("/api/webhook/sms", async (req, res) => {
    if (req.method === "GET") {
      return res.type("text/xml").send("<Response></Response>");
    }
    // Twilio sends x-www-form-urlencoded
    const { From, Body, To } = req.body;
    
    // Robust phone cleaning: keep only digits
    const cleanNumber = (n: any) => String(n || "").replace(/[^\d]/g, "");
    
    const cleanFrom = cleanNumber(From);
    const cleanTo = cleanNumber(To);
    const rawBody = (Body || "").trim();
    
    console.log(`[REPLY WEBHOOK] Received: From=${From}, To=${To}, Body=${rawBody}`);

    try {
      // Find the user who owns this 'To' number
      const settingsSnap = await db.collection("settings").get();
      let foundUserId = null;
      let foundSettings = null;

      // 1. Direct deep search through all accounts
      for (const doc of settingsSnap.docs) {
        const data = doc.data();
        const stored = cleanNumber(data.phoneNumber);
        
        // Exact match or ends-with match
        if (stored && (cleanTo.endsWith(stored) || stored.endsWith(cleanTo))) {
          foundUserId = doc.id;
          foundSettings = data;
          break;
        }
        
        // Sandbox fallback
        if (cleanTo === "14155238886" || cleanTo === "12182315880") {
            // If the user's setting contains either the SMS or WhatsApp number, it's a match
            if (stored.includes("4155238886") || stored.includes("2182315880")) {
                foundUserId = doc.id;
                foundSettings = data;
                break;
            }
        }
      }

      // 2. Global Fallback: If only one user exists, they get the messages (standard for single-user AI Studio apps)
      if (!foundUserId && settingsSnap.size === 1) {
          foundUserId = settingsSnap.docs[0].id;
          foundSettings = settingsSnap.docs[0].data();
          console.log(`[REPLY WEBHOOK] Single user fallback matched: ${foundUserId}`);
      }

      if (!foundUserId) {
        console.warn(`[REPLY WEBHOOK] No business account found matching ${cleanTo}`);
        return res.type("text/xml").send("<Response></Response>");
      }

      const logsRef = db.collection("calls").doc(foundUserId).collection("logs");
      const allLogsSnap = await logsRef.get();
      
      // Match logs using the last 10 digits of the customer number
      const matchingLogs = allLogsSnap.docs.filter(d => {
        const stored = cleanNumber(d.data().customerNumber);
        if (!stored || !cleanFrom) return false;
        return stored.endsWith(cleanFrom.slice(-10)) || cleanFrom.endsWith(stored.slice(-10));
      });

      const isWhatsApp = To.startsWith("whatsapp:");
      const channel = isWhatsApp ? "whatsapp" : "sms";

      if (matchingLogs.length > 0) {
        const sortedDocs = matchingLogs.sort((a, b) => {
          const dataA = a.data();
          const dataB = b.data();
          const timeA = dataA.timestamp?.toDate ? dataA.timestamp.toDate() : new Date(dataA.timestamp || 0);
          const timeB = dataB.timestamp?.toDate ? dataB.timestamp.toDate() : new Date(dataB.timestamp || 0);
          return (timeB as any) - (timeA as any);
        });

        const latestLog = sortedDocs[0];
        const logId = latestLog.id;
        const ratingMatch = rawBody.match(/\d/);
        const rating = ratingMatch ? parseInt(ratingMatch[0]) : NaN;
        
        // Always save the message body and detected channel
        await logsRef.doc(logId).update({
          lastMessage: rawBody,
          channel: channel
        });
        
        if (!isNaN(rating)) {
          console.log(`[REPLY WEBHOOK] Updating log ${logId} with rating: ${rating}`);
          await logsRef.doc(logId).update({
            rating: rating,
            notes: `Auto-rated ${rating} via ${channel} reply.`
          });

          const activeProfile = foundSettings.profiles?.find((p: any) => p.id === foundSettings.activeProfileId) || foundSettings;
          const reviewLink = activeProfile.googleReviewLink || foundSettings.googleReviewLink;

          const client = getTwilio();
          if (client && rating >= 4 && reviewLink) {
            await client.messages.create({
              body: `Huge thanks for the ${rating}-star rating! Since you're happy, could you leave a quick review here? ${reviewLink}`,
              from: To,
              to: From
            });
            await logsRef.doc(logId).update({ gatekeepingStep: 'link_sent' });
          } else if (client && rating < 4) {
            await client.messages.create({
              body: "Thank you for the feedback. We're sorry we didn't meet your expectations. A manager will follow up shortly to make things right.",
              from: To,
              to: From
            });
            await logsRef.doc(logId).update({ gatekeepingStep: 'feedback_received' });
          }
        }
      } else {
        // NEW LOGIC: If no existing log found, create one for this incoming message
        console.log(`[REPLY WEBHOOK] No existing log for ${cleanFrom}. Creating new interaction log.`);
        await logsRef.add({
          customerNumber: From,
          timestamp: FieldValue.serverTimestamp(),
          status: 'responded',
          smsSent: false,
          channel: channel,
          lastMessage: rawBody,
          notes: `Incoming ${channel.toUpperCase()} message from new customer.`
        });
      }
    } catch (err) {
      console.error("[REPLY WEBHOOK] Error:", err);
    }

    res.type("text/xml").send("<Response></Response>");
  });

  // --- 4. THE LIVE WEBHOOK (The "Real Guy" Logic) ---
  // Give this URL to Twilio: [YOUR_APP_URL]/api/webhook/voice
  app.all("/api/webhook/voice", async (req, res) => {
    if (req.method === "GET") {
      return res.type("text/xml").send("<Response></Response>");
    }
    const { From, To, CallStatus } = req.body;
    
    console.log(`[VOICE WEBHOOK] Incoming -> From: ${From}, To: ${To}, Status: ${CallStatus}`);

    // Check if the call was missed/failed
    const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
    
    if (missedStatuses.includes(CallStatus?.toLowerCase())) {
      console.log(`[VOICE WEBHOOK] Missed call detected! Searching for settings for: ${To}`);
      try {
        // Find the Business Owner who owns this 'To' number
        const settingsSnap = await db.collection("settings")
          .where("phoneNumber", "==", To)
          .limit(1)
          .get();
        
        // Try fallback if exact match fails (in case formatting differs)
        let foundDoc = settingsSnap.empty ? null : settingsSnap.docs[0];
        
        if (!foundDoc) {
             const allSettings = await db.collection("settings").get();
             foundDoc = allSettings.docs.find(d => {
                 const canon = (n: string) => n.replace(/[^\d]/g, "");
                 const stored = canon(d.data().phoneNumber || "");
                 const incoming = canon(To || "");
                 return stored && (incoming === stored || incoming.endsWith(stored));
             }) || null;
        }

        if (foundDoc) {
          const userId = foundDoc.id;
          const settings = foundDoc.data();
          console.log(`[VOICE WEBHOOK] Match found for User: ${userId}`);

          if (settings.autoReplyEnabled) {
            const activeProfile = settings.profiles?.find((p: any) => p.id === settings.activeProfileId) || settings;
            const message = activeProfile.missedCallSmsTemplate || settings.missedCallSmsTemplate || "Hey, missed our call! How can I help?";
            const channel = settings.preferredChannel || 'sms';

            const client = getTwilio();
            if (client) {
              const fromVal = channel === 'whatsapp' ? `whatsapp:${To}` : To;
              const toVal = channel === 'whatsapp' ? `whatsapp:${From}` : From;

              await client.messages.create({
                body: message,
                from: fromVal,
                to: toVal
              });

              // Log it in the Dashboard
              await db.collection("calls").doc(userId).collection("logs").add({
                customerNumber: From,
                timestamp: FieldValue.serverTimestamp(),
                status: "missed",
                smsSent: true,
                channel: channel,
                notes: `Automated ${channel.toUpperCase()} triggered by live webhook.`
              });

              console.log(`Live automation (${channel}) triggered successfully for ${From}`);
            }
          }
        }
      } catch (error) {
        console.error("Webhook Error Logic:", error);
      }
    }

    res.type("text/xml");
    res.send("<Response></Response>");
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
