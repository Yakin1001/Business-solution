/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { BusinessSettings, CallLog, BusinessProfile } from './types';
import { 
  Phone, 
  MessageSquare, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  History,
  Star,
  Send,
  Loader2,
  PhoneMissed,
  Trash2,
  Briefcase,
  Layers,
  Sparkles,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

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

function Sidebar({ activeTab, setActiveTab, user, settings }: { activeTab: string, setActiveTab: (t: string) => void, user: User, settings: BusinessSettings }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Call Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
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

        {/* System Status Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                    System Active
                </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-1.5 leading-tight">
              {settings.phoneNumber ? `Linked to ${settings.phoneNumber}` : "⚠️ Set number in Settings"}
            </p>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings, userId }: { settings: BusinessSettings, userId: string }) {
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [activeProfileIdx, setActiveProfileIdx] = useState(0);

  // Initialize profiles if they don't exist (Migration logic)
  useEffect(() => {
    if (!settings.profiles || settings.profiles.length === 0) {
      const defaultProfile: BusinessProfile = {
        id: 'default',
        name: 'General',
        industry: 'General',
        missedCallSmsTemplate: settings.missedCallSmsTemplate || 'Hey, sorry we missed your call. How can we help?',
        googleReviewLink: settings.googleReviewLink || '',
        surveyMessage: settings.surveyMessage || 'On a scale of 1-5, how was your experience today?'
      };
      setForm(prev => ({
        ...prev,
        activeProfileId: 'default',
        profiles: [defaultProfile]
      }));
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', userId), form);
      alert('All business profiles saved!');
    } catch (error) {
      console.error(error);
      alert('Save failed. Check permissions.');
    } finally {
      setSaving(false);
    }
  };

  const addProfile = () => {
    const newId = `profile_${Date.now()}`;
    const newProfile: BusinessProfile = {
      id: newId,
      name: 'New Industry',
      industry: 'General',
      missedCallSmsTemplate: 'Hi! We missed your call. How can we help?',
      googleReviewLink: '',
      surveyMessage: 'Rate us 1-5'
    };
    const updatedProfiles = [...(form.profiles || []), newProfile];
    setForm({ ...form, profiles: updatedProfiles });
    setActiveProfileIdx(updatedProfiles.length - 1);
  };

  const removeProfile = (idx: number) => {
    if ((form.profiles?.length || 0) <= 1) {
      alert('You must have at least one profile.');
      return;
    }
    const updated = (form.profiles || []).filter((_, i) => i !== idx);
    setForm({ ...form, profiles: updated });
    setActiveProfileIdx(0);
  };

  const updateProfileField = (idx: number, field: keyof BusinessProfile, value: string) => {
    const updated = [...(form.profiles || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, profiles: updated });
  };

  const currentProfile = form.profiles?.[activeProfileIdx];

  return (
    <div id="settings-view" className="max-w-4xl pb-20">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Industry Profiles</h2>
          <p className="text-slate-500 text-sm">Switch between business types to customize messages for each.</p>
        </div>
        <button 
          onClick={addProfile}
          className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Profile
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="space-y-2">
          {form.profiles?.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setActiveProfileIdx(idx)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-between group ${
                activeProfileIdx === idx 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Briefcase className={`w-4 h-4 ${activeProfileIdx === idx ? 'text-indigo-200' : 'text-slate-400'}`} />
                <span className="truncate">{p.name}</span>
              </div>
              {idx === activeProfileIdx && (
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <form onSubmit={handleSave} className="md:col-span-3 space-y-6">
          {currentProfile ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-slate-50 -mx-8 -mt-8 p-4 border-b border-slate-100 rounded-t-2xl">
                 <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Editing Profile</span>
                 </div>
                 <button 
                    type="button"
                    onClick={() => removeProfile(activeProfileIdx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Profile"
                 >
                    <Trash2 className="w-4 h-4" />
                 </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Profile Name</label>
                  <input
                    type="text"
                    value={currentProfile.name}
                    onChange={(e) => updateProfileField(activeProfileIdx, 'name', e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700"
                    placeholder="e.g. HVAC Service"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Industry</label>
                  <select
                    value={currentProfile.industry}
                    onChange={(e) => updateProfileField(activeProfileIdx, 'industry', e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700"
                  >
                    <option value="HVAC">HVAC & Plumbing</option>
                    <option value="Salon">Salon & Beauty</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Legal">Legal & Professional</option>
                    <option value="Medical">Medical & Dental</option>
                    <option value="Restaurant">Restaurant & Cafe</option>
                    <option value="General">General / Others</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    Automated Messaging
                </h3>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Missed Call SMS Template</label>
                  <textarea
                    rows={3}
                    value={currentProfile.missedCallSmsTemplate}
                    onChange={(e) => updateProfileField(activeProfileIdx, 'missedCallSmsTemplate', e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic font-mono text-slate-600 bg-slate-50/30"
                    placeholder="Hi! Sorry we missed your call..."
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">This text goes out immediately after a missed call.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Survey/Gatekeeping Message</label>
                  <input
                    type="text"
                    value={currentProfile.surveyMessage}
                    onChange={(e) => updateProfileField(activeProfileIdx, 'surveyMessage', e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700"
                    placeholder="On a scale of 1-5, how was your experience?"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Google Review Link</label>
                  <input
                    type="url"
                    value={currentProfile.googleReviewLink}
                    onChange={(e) => updateProfileField(activeProfileIdx, 'googleReviewLink', e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700"
                    placeholder="https://g.page/business/review"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                 <h3 className="font-bold text-slate-800 text-sm mb-6 flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-indigo-500" />
                    Global System Settings
                 </h3>
                 <div className="grid grid-cols-2 gap-8 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Carrier & Channel</label>
                        <div className="flex gap-2">
                            {['sms', 'whatsapp'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setForm({...form, preferredChannel: c as any})}
                                    className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                                        form.preferredChannel === c 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                                    }`}
                                >
                                    {c === 'whatsapp' ? <MessageSquare className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                                    {c.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] text-slate-400 italic">
                           {form.preferredChannel === 'sms' 
                             ? "Trial accounts can only send SMS to verified numbers." 
                             : "Using WhatsApp Sandbox. Upgrade Twilio to use your own professional number."}
                        </p>
                        <p className="text-[9px] text-slate-400 italic">
                           {form.preferredChannel === 'sms' 
                             ? "Trial accounts can only send SMS to verified numbers." 
                             : "Using WhatsApp Sandbox. Upgrade Twilio to use your own professional number."}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Automation Status</label>
                        <div className="flex items-center gap-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.autoReplyEnabled}
                                    onChange={(e) => setForm({ ...form, autoReplyEnabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                            <span className="text-xs font-bold text-slate-600">Auto-Reply {form.autoReplyEnabled ? 'Active' : 'Paused'}</span>
                        </div>
                    </div>
                 </div>
                 
                 <div className="mt-6">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Business Phone (Twilio Assigned)</label>
                    <input
                        type="text"
                        value={form.phoneNumber}
                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                        placeholder="+1..."
                    />
                 </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">Active Profile</h4>
                  <p className="text-[10px] text-indigo-600">The webhook will use this profile for responders.</p>
                </div>
                <button
                   type="button"
                   onClick={() => setForm({ ...form, activeProfileId: currentProfile.id })}
                   className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                     form.activeProfileId === currentProfile.id 
                       ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                       : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white'
                   }`}
                >
                  {form.activeProfileId === currentProfile.id ? 'Currently Active' : 'Make This Active'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              <p className="text-slate-400 font-medium italic">Create an industry profile to get started.</p>
            </div>
          )}

          <div className="flex justify-end gap-4">
             <button
               id="settings-save-btn"
               type="submit"
               disabled={saving}
               className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 disabled:opacity-50 flex items-center gap-2 active:scale-95"
             >
               {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
               Save All Profiles
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CallLogsView({ logs, settings, userId }: { logs: CallLog[], settings: BusinessSettings, userId: string }) {
  const [simulating, setSimulating] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isExtractingNames, setIsExtractingNames] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const extractNames = async () => {
    const logsToProcess = logs.filter(l => l.lastMessage && !l.customerName);
    if (logsToProcess.length === 0) {
      alert('Already processed or no data found to extract names from.');
      return;
    }

    setIsExtractingNames(true);
    try {
      const dataToProcess = logsToProcess.map(l => ({ id: l.id, message: l.lastMessage }));
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract person names from these messages if they are introducing themselves (e.g. "Hi I'm John" -> "John"). Ignore messages where no name is clearly stated. Return only JSON array of objects with id and name.
        Messages: ${JSON.stringify(dataToProcess)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING }
              }
            }
          }
        }
      });

      const extracted = JSON.parse(response.text || '[]');
      let count = 0;
      for (const item of extracted) {
        if (item.name && item.id) {
          await setDoc(doc(db, 'calls', userId, 'logs', item.id), { customerName: item.name }, { merge: true });
          count++;
        }
      }
      alert(`AI Extraction Complete! Found ${count} names.`);
    } catch (error) {
      console.error(error);
      alert('AI Extraction failed. Check internet or API quota.');
    } finally {
      setIsExtractingNames(false);
    }
  };

  const saveManualName = async (id: string) => {
    try {
      await setDoc(doc(db, 'calls', userId, 'logs', id), { customerName: tempName }, { merge: true });
      setEditingNameId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const updateStatus = async (id: string, status: CallLog['status']) => {
    try {
      await setDoc(doc(db, 'calls', userId, 'logs', id), { status }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const sendReviewLink = async (log: CallLog) => {
    const activeProfile = settings.profiles?.find(p => p.id === settings.activeProfileId) || {
      missedCallSmsTemplate: settings.missedCallSmsTemplate,
      googleReviewLink: settings.googleReviewLink,
      surveyMessage: settings.surveyMessage
    };

    if (!activeProfile.googleReviewLink) {
      alert('Please set your Google Review link in the active profile first.');
      return;
    }
    try {
      const isGatekeeping = settings.gatekeepingEnabled;
      const message = isGatekeeping 
        ? activeProfile.surveyMessage : `Thanks for working with us! We'd love a review: ${activeProfile.googleReviewLink}`;

      const resp = await fetch('/api/missed-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: log.customerNumber,
          businessNumber: settings.phoneNumber,
          channel: settings.preferredChannel,
          message: message
        })
      });
      const data = await resp.json();

      await setDoc(doc(db, 'calls', userId, 'logs', log.id), { 
        reviewLinkSent: true,
        gatekeepingStep: isGatekeeping ? 'survey_sent' : 'link_sent'
      }, { merge: true });

      if (data.success) {
        alert(isGatekeeping ? 'Survey sent!' : `Review link sent to ${log.customerNumber}!`);
      } else {
        alert('Action recorded, but message could not be sent (Check Twilio credentials).');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const simulateCall = async () => {
    setSimulating(true);
    const activeProfile = settings.profiles?.find(p => p.id === settings.activeProfileId) || {
      missedCallSmsTemplate: settings.missedCallSmsTemplate,
      googleReviewLink: settings.googleReviewLink,
      surveyMessage: settings.surveyMessage
    };

    try {
      const rawNumber = testNumber || `+1 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`;
      // Clean number immediately for DB consistency
      const customerNumber = rawNumber.replace(/[^\d+]/g, "");
      
      const resp = await fetch('/api/missed-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber,
          businessNumber: settings.phoneNumber,
          channel: settings.preferredChannel,
          message: activeProfile.missedCallSmsTemplate
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
        alert(`Real ${settings.preferredChannel.toUpperCase()} sent to ${customerNumber}!`);
      } else {
        alert(`Simulation Failed: ${data.error || 'Unknown error'}. \n\nSuggestion: ${data.suggestion || 'Check your Twilio console settings.'}`);
      }
      
    } catch (error) {
      console.error(error);
    } finally {
      setSimulating(false);
    }
  };

  const simulateRating = async (log: CallLog, rating: number) => {
    if (!userId) return;
    try {
      // Direct Firestore update from client - avoids backend permission issues for simulation
      const gatekeepingStep = rating >= 4 ? 'link_sent' : 'feedback_received';
      const logRef = doc(db, 'calls', userId, 'logs', log.id);
      
      await setDoc(logRef, {
        rating: rating,
        gatekeepingStep: gatekeepingStep,
        notes: `(SIMULATED) Rated ${rating} via client.`
      }, { merge: true });

      alert(`Successfully simulated a ${rating}-star rating! (Direct Update)`);
    } catch (e: any) {
      console.error(e);
      alert(`Simulation Error: ${e.message}`);
    }
  };

  const deleteLog = async (id: string) => {
    setIsDeletingId(id);
    try {
      await deleteDoc(doc(db, 'calls', userId, 'logs', id));
    } catch (error: any) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
    } finally {
      setIsDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const clearAllLogs = async () => {
    setIsClearing(true);
    try {
      const logsRef = collection(db, 'calls', userId, 'logs');
      const snap = await getDocs(logsRef);
      if (snap.empty) {
        alert('No history to clear.');
        setIsClearing(false);
        setConfirmClear(false);
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      alert('History cleared successfully!');
    } catch (error: any) {
      console.error(error);
      alert(`Clear History failed: ${error.message}`);
    } finally {
      setIsClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <div id="logs-view">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
          <p className="text-slate-500 text-sm">Review your missed calls and automated responses.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
               onClick={extractNames}
               disabled={isExtractingNames}
               className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-100 transition-all shadow-sm border border-amber-100 disabled:opacity-50"
            >
              {isExtractingNames ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Extract Names
            </button>
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
              Test Live {settings.preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </button>
          </div>
        </div>
          {settings.preferredChannel === 'whatsapp' && (
            <a 
              href={`https://wa.me/${settings.phoneNumber.replace('+', '')}?text=Hi`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-indigo-500 font-bold hover:underline flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
            >
              Session closed? Click here to send "Hi" and open it first
            </a>
          )}
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Recent Activity</h2>
          {logs.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClear ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Are you sure?</span>
                  <button 
                    onClick={clearAllLogs}
                    disabled={isClearing}
                    className="text-[10px] bg-red-600 text-white hover:bg-red-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Yes, Delete Everything
                  </button>
                  <button 
                    onClick={() => setConfirmClear(false)}
                    disabled={isClearing}
                    className="text-[10px] bg-slate-200 text-slate-600 hover:bg-slate-300 px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmClear(true)}
                  className="text-[10px] bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear History
                </button>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs font-semibold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Latest Reply</th>
                <th className="px-6 py-3">Action Taken</th>
                <th className="px-6 py-3 text-right">Follow up</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No calls recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm ${
                            log.status === 'missed' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {log.customerName ? log.customerName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        <div>
                          <div className="flex items-center gap-2">
                             {editingNameId === log.id ? (
                                <div className="flex items-center gap-1">
                                    <input 
                                        autoFocus
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onBlur={() => saveManualName(log.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveManualName(log.id)}
                                        className="text-xs px-2 py-1 border rounded-md outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                                    />
                                    <button onClick={() => saveManualName(log.id)} className="text-[10px] text-green-500 font-bold">Save</button>
                                </div>
                              ) : (
                                <p 
                                    className="font-medium text-slate-900 cursor-pointer hover:text-indigo-600 flex items-center gap-1.5"
                                    onClick={() => { setEditingNameId(log.id); setTempName(log.customerName || ''); }}
                                    title="Click to edit name"
                                >
                                    {log.customerName || 'Unknown Name'}
                                </p>
                              )}
                              
                              {log.channel && (
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none ${
                                    log.channel === 'whatsapp' 
                                    ? 'bg-green-50 border-green-200 text-green-600' 
                                    : 'bg-blue-50 border-blue-200 text-blue-600'
                                }`}>
                                    {log.channel}
                                </span>
                              )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono tracking-tighter mt-0.5">{log.customerNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <div className="text-[10px] font-bold text-slate-300 uppercase mt-0.5 tracking-tighter">
                          {new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.lastMessage ? (
                          <div className="flex flex-col gap-1">
                              <div className="bg-indigo-50/30 p-2 rounded-lg border border-indigo-100/50 max-w-[150px]">
                                  <p className="text-[11px] text-slate-600 italic">"{log.lastMessage}"</p>
                              </div>
                          </div>
                      ) : (
                          <span className="text-[10px] text-slate-300 italic font-medium">Waiting...</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          log.status === 'missed' ? 'bg-red-50 text-red-700' :
                          log.status === 'responded' ? 'bg-indigo-50 text-indigo-700' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {log.smsSent && log.status === 'missed' ? 'Automated Message Sent' : log.status}
                        </span>
                        {log.gatekeepingStep && log.gatekeepingStep !== 'none' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                               Step: {log.gatekeepingStep.replace('_', ' ')}
                            </span>
                            {log.rating ? (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star} 
                                    className={`w-3 h-3 ${star <= log.rating! ? 'text-amber-400 fill-current' : 'text-slate-200'}`} 
                                  />
                                ))}
                                <span className="text-[10px] font-bold text-slate-500 ml-1">({log.rating})</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-300 italic">Awaiting response...</span>
                            )}
                          </div>
                        ) : log.rating ? (
                          <div className="flex items-center gap-0.5">
                             {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={`w-3 h-3 ${star <= log.rating! ? 'text-amber-400 fill-current' : 'text-slate-200'}`} 
                              />
                            ))}
                            <span className="text-[10px] font-bold text-slate-500 ml-1">({log.rating})</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-50 mt-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Test Logic</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => simulateRating(log, 5)}
                            className="text-[9px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 hover:bg-green-100 font-bold"
                          >
                            Simulate 5★
                          </button>
                          <button
                            onClick={() => simulateRating(log, 1)}
                            className="text-[9px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 hover:bg-red-100 font-bold"
                          >
                            Simulate 1★
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1 flex justify-end items-center">
                      <div className="flex items-center gap-1">
                        {deleteConfirmId === log.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                            <button 
                              onClick={() => deleteLog(log.id)}
                              disabled={isDeletingId === log.id}
                              className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                              title="Confirm Delete"
                            >
                              {isDeletingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={isDeletingId === log.id}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 rotate-45" /> 
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(log.id)}
                            className="p-2 transition-colors text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            title="Delete Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
            <h2 className="font-semibold text-slate-800">Recent Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {logs.slice(0, 5).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-mono font-medium">{log.customerNumber}</td>
                    <td className="px-4 py-3">
                      {log.rating ? (
                         <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`w-3 h-3 ${star <= log.rating! ? 'text-amber-400 fill-current' : 'text-slate-200'}`} 
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">No rating</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    autoReplyEnabled: true,
    preferredChannel: 'sms',
    gatekeepingEnabled: false,
    surveyMessage: 'On a scale of 1-5, how was your experience today?'
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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} settings={settings} />
      
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
