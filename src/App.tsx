/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit } from 'firebase/firestore';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { BusinessSettings, CallLog } from './types';
import { 
  Phone, 
  MessageSquare, 
  Settings, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  History,
  Star,
  Send,
  Loader2,
  PhoneMissed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

function AuthScreen() {
  return (
    <div id="auth-screen" className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="max-w-md w-full p-8 text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Phone className="text-white w-8 h-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">CallWise</h1>
        <p className="text-slate-500 mb-8">Never miss a lead. Automate your first response and collect reviews effortlessly.</p>
        <button
          id="google-login-btn"
          onClick={loginWithGoogle}
          className="w-full py-3.5 px-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-md shadow-slate-200 active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, user }: { activeTab: string, setActiveTab: (t: string) => void, user: User }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Call Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div id="sidebar" className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Phone className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">CallWise</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium ${
              activeTab === tab.id 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-xl mb-4">
           <div className="flex items-center gap-3 mb-2">
            <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
            <p className="text-xs font-semibold text-slate-800 truncate">{user.displayName}</p>
          </div>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Connected Account</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          id="logout-btn"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-600 rounded-md transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function SettingsView({ settings, userId }: { settings: BusinessSettings, userId: string }) {
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', userId), form);
      alert('Settings saved!');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="settings-view" className="max-w-2xl">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 text-sm">Configure your automated responses and business details.</p>
      </header>
      
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Phone Number</label>
            <input
              id="settings-phone"
              type="text"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="+1 234 567 8900"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Missed Call SMS Template</label>
            <textarea
              id="settings-sms-template"
              rows={3}
              value={form.missedCallSmsTemplate}
              onChange={(e) => setForm({ ...form, missedCallSmsTemplate: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all italic font-mono text-slate-600"
              placeholder="Hi! Sorry we missed your call. How can we help you today?"
              required
            />
            <p className="text-xs text-slate-400 mt-1">This message is sent automatically when you miss a call.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Google Review Link</label>
            <input
              id="settings-review-link"
              type="url"
              value={form.googleReviewLink}
              onChange={(e) => setForm({ ...form, googleReviewLink: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="https://g.page/r/your-business/review"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                id="settings-auto-reply"
                type="checkbox"
                checked={form.autoReplyEnabled}
                onChange={(e) => setForm({ ...form, autoReplyEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
            <label htmlFor="settings-auto-reply" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Enable Automated Responses</label>
          </div>
        </div>

        <button
          id="settings-save-btn"
          type="submit"
          disabled={saving}
          className="w-full bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}

function CallLogsView({ logs, settings, userId }: { logs: CallLog[], settings: BusinessSettings, userId: string }) {
  const [simulating, setSimulating] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  const updateStatus = async (id: string, status: CallLog['status']) => {
    try {
      await setDoc(doc(db, 'calls', userId, 'logs', id), { status }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const sendReviewLink = async (log: CallLog) => {
    if (!settings.googleReviewLink) {
      alert('Please set your Google Review link in Settings first.');
      return;
    }
    try {
      console.log(`Sending review link to ${log.customerNumber}: ${settings.googleReviewLink}`);
      
      const resp = await fetch('/api/missed-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: log.customerNumber,
          businessNumber: settings.phoneNumber,
          message: `Thanks for working with us! We'd love a review: ${settings.googleReviewLink}`
        })
      });
      const data = await resp.json();

      await setDoc(doc(db, 'calls', userId, 'logs', log.id), { 
        reviewLinkSent: true,
        status: 'settled' 
      }, { merge: true });

      if (data.success) {
        alert(`Review link sent to ${log.customerNumber} via Twilio!`);
      } else {
        alert('Action recorded, but SMS could not be sent (Check Twilio credentials or verification).');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const simulateCall = async () => {
    setSimulating(true);
    try {
      const customerNumber = testNumber || `+1 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`;
      
      const resp = await fetch('/api/missed-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber,
          businessNumber: settings.phoneNumber,
          message: settings.missedCallSmsTemplate
        })
      });
      const data = await resp.json();

      const callId = `call_${Date.now()}`;
      await setDoc(doc(db, 'calls', userId, 'logs', callId), {
        customerNumber,
        timestamp: new Date().toISOString(),
        status: 'missed',
        smsSent: data.success || settings.autoReplyEnabled,
        notes: ''
      });
      
      if (data.success) {
        alert(`Real SMS sent to ${customerNumber}!`);
      } else if (testNumber) {
        alert('Simulation ran, but SMS failed. Make sure the number is VERIFIED in your Twilio trial account.');
      }
      
    } catch (error) {
      console.error(error);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div id="logs-view">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
          <p className="text-slate-500 text-sm">Review your missed calls and automated responses.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
          <input 
            type="text" 
            placeholder="Verified Phone # to test"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            className="px-3 py-1.5 text-xs border-none focus:ring-0 outline-none w-48 text-indigo-900 font-mono"
          />
          <button
            id="simulate-call-btn"
            onClick={simulateCall}
            disabled={simulating}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
          >
            {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneMissed className="w-4 h-4" />}
            Test Live SMS
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs font-semibold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Action Taken</th>
                <th className="px-6 py-3 text-right">Follow up</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No calls recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 font-mono">{log.customerNumber}</div>
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Unknown Caller</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        log.status === 'missed' ? 'bg-red-50 text-red-700' :
                        log.status === 'responded' ? 'bg-indigo-50 text-indigo-700' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.smsSent && log.status === 'missed' ? 'SMS Sent' : log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button 
                        onClick={() => {
                          window.open(`tel:${log.customerNumber}`);
                          updateStatus(log.id, 'responded');
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" 
                        title="Call Back"
                      >
                        <Phone className="w-4 h-4 inline" />
                      </button>
                      <button 
                        onClick={() => sendReviewLink(log)}
                        disabled={log.reviewLinkSent}
                        className={`p-2 transition-colors ${log.reviewLinkSent ? 'text-green-500' : 'text-slate-400 hover:text-indigo-600'}`}
                        title={log.reviewLinkSent ? "Review Link Already Sent" : "Request Review"}
                      >
                        <Star className={`w-4 h-4 inline ${log.reviewLinkSent ? 'fill-current' : ''}`} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ logs }: { logs: CallLog[] }) {
  const stats = [
    { label: "Today's Missed", value: logs.length, color: 'text-indigo-600' },
    { label: 'Auto-Replies', value: logs.filter(l => l.smsSent).length, color: 'text-green-600' },
  ];

  return (
    <div id="dashboard-view" className="flex flex-col h-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">Manage missed calls and follow-ups effectively.</p>
        </div>
        <div className="flex gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white px-6 py-4 rounded-xl border border-slate-200 text-center shadow-sm min-w-[140px]">
              <span className={`block text-2xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-8 flex-1">
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Recent Missed Calls</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
             <LayoutDashboard className="w-12 h-12 text-slate-300 mb-2" />
             <p className="text-sm text-slate-500 font-medium italic">Latest trends and call volumes visualization</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Automation</h3>
              <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">Auto-reply is active for all missed calls.</p>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-mono text-slate-600 italic leading-relaxed">
                "Hey, sorry we missed your call! How can I help you today?"
              </p>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Google Review</h3>
            <div className="space-y-4">
              <div className="text-xs text-slate-500 font-medium">Link configured in settings.</div>
              <input 
                type="text" 
                className="w-full text-sm border-slate-200 rounded-lg bg-slate-50 text-slate-500 py-2 px-3 border" 
                value="g.page/business/review" 
                readOnly 
              />
              <button className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 shadow-md shadow-slate-200 active:scale-95 transition-all">
                Send Manual Broadcast
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState<BusinessSettings>({
    phoneNumber: '',
    missedCallSmsTemplate: 'Hey, you missed a call. What can I do for you?',
    googleReviewLink: '',
    autoReplyEnabled: true
  });
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to settings
    const unsubSettings = onSnapshot(doc(db, 'settings', user.uid), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as BusinessSettings);
      }
    });

    // Listen to call logs
    const logsQuery = query(
      collection(db, 'calls', user.uid, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CallLog));
      setLogs(newLogs);
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div id="main-layout" className="min-h-screen bg-[#F9FAFB]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      
      <main className="ml-64 p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardView logs={logs} />}
            {activeTab === 'logs' && <CallLogsView logs={logs} settings={settings} userId={user.uid} />}
            {activeTab === 'settings' && <SettingsView settings={settings} userId={user.uid} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
