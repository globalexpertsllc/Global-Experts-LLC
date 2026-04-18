import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom';
import i18n from './i18n';
import { useTranslation } from 'react-i18next';
import { initializeApp } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateEmail,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  updatePassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  getDocs,
  limit,
  arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage, firebaseConfigExport } from './firebase';
import { Toaster, toast } from 'sonner';
import { Rnd } from 'react-rnd';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Folder as FolderIcon,
  File as FileIcon,
  History,
  Cake,
  Home as HomeIcon,
  ExternalLink,
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  MessageCircle,
  CalendarDays,
  LogOut, 
  ChevronRight, 
  Plus, 
  FileText, 
  CheckCircle, 
  Clock, 
  User as UserIcon,
  Search,
  Activity,
  Share2,
  RefreshCw,
  Save,
  MoreVertical,
  Eye,
  EyeOff,
  Flag,
  Edit3,
  Menu,
  X,
  Send,
  Settings,
  Lock,
  Mail,
  Phone,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MapPin,
  Download,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  PenTool,
  Paperclip,
  Image,
  Type,
  Globe,
  Shield,
  Sun,
  Moon,
  RotateCcw,
  Check,
  CheckCheck,
  FolderOpen,
  Camera,
  Pause,
  Play,
  FileUp,
  ChevronDown,
  Copy,
  ClipboardCheck,
  GripVertical,
  Sparkles,
  Briefcase,
  Award,
  Gift,
  UserPlus,
  UserX,
  FolderPlus,
  Folder,
  ChevronLeft,
  LogIn,
  Table,
  UserMinus,
  Bell,
  FileWarning,
  FilePlus,
  Inbox,
  ShieldCheck,
  Edit,
  Upload,
  Star,
  Crown,
  Hash,
  ShieldAlert,
  BarChart3,
  Calendar,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  UserProfile, 
  Conversation, 
  Message, 
  AppNotification, 
  Appointment, 
  PartialPayment,
  SharedFile,
  Service,
  Office,
  FormTemplate,
  FormSubmission,
  TimeOffRequest,
  Referral,
  Reminder,
  AuditMetadata,
  OfficeAssignment
} from './types';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as any;

const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
  userTypeLabel: string;
  canEdit: boolean;
  isSeniorAdmin: boolean;
  isJuniorAdmin: boolean;
  updateLanguage: (lang: string) => Promise<void>;
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loginLoggedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const unsubProfile = onSnapshot(doc(db, 'users', u.uid), (doc) => {
          const p = doc.exists() ? { uid: doc.id, ...doc.data() } as UserProfile : null;
          setProfile(p);
          setLoading(false);
          
          if (p && p.role === 'admin' && loginLoggedRef.current !== u.uid) {
            logGlobalAudit(p, 'Login', 'system', 'User logged into the application');
            loginLoggedRef.current = u.uid;
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
        loginLoggedRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = (!!profile && profile.role === 'admin' && profile.status === 'active') ||
    (!!user && user.email === "customercare@globalexpertsplus.com");
  const isEmployee = !!profile && !!profile.isEmployee;
  const isClient = !!profile && profile.role === 'client' && !isEmployee;

  const userTypeLabel = useMemo(() => {
    if (isEmployee) return profile?.employeeDisplayName || profile?.displayName || 'Employee';
    if (isAdmin) return 'Administrator';
    if (isClient) return 'Client';
    return '';
  }, [isAdmin, isEmployee, isClient, profile]);

  const canEdit = isAdmin;
  const isSeniorAdmin = profile?.role === 'admin' && profile?.adminRank === 'senior';
  const isJuniorAdmin = profile?.role === 'admin';

  const updateLanguage = async (lang: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { preferredLanguage: lang });
      i18n.changeLanguage(lang);
    } catch (error) {
      console.error('Error updating language:', error);
    }
  };

  const toggleTheme = async () => {
    if (!user || !profile) return;
    try {
      const newTheme = profile.theme === 'dark' ? 'light' : 'dark';
      await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
    } catch (error) {
      console.error('Error toggling theme:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin, 
      isEmployee, 
      isClient, 
      userTypeLabel,
      canEdit,
      isSeniorAdmin,
      isJuniorAdmin,
      updateLanguage,
      toggleTheme
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const sendNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      link: link || null
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

const ChatWindow = ({ clientId, clientName, onClose }: { clientId: string, clientName: string, onClose?: () => void }) => {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!clientId) return;

    const q = query(
      collection(db, 'messages'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    if (isAdmin) {
      const convRef = doc(db, 'conversations', clientId);
      updateDoc(convRef, { unreadCount: 0 }).catch(() => {});
    }

    return () => unsubscribe();
  }, [clientId, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!clientId || !user) return;
    const typingRef = doc(db, 'typing', clientId);
    
    const unsubscribe = onSnapshot(typingRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const otherId = isAdmin ? clientId : 'admin';
        setOtherTyping(!!data[otherId]);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `typing/${clientId}`));

    return () => unsubscribe();
  }, [clientId, user, isAdmin]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping && user) {
      setIsTyping(true);
      const typingRef = doc(db, 'typing', clientId);
      const myId = isAdmin ? 'admin' : user.uid;
      setDoc(typingRef, { [myId]: true }, { merge: true }).catch(() => {});
      
      setTimeout(() => {
        setIsTyping(false);
        setDoc(typingRef, { [myId]: false }, { merge: true }).catch(() => {});
      }, 3000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !profile || isSending) return;

    setIsSending(true);
    const msgData: Omit<Message, 'id'> = {
      clientId,
      senderId: user.uid,
      senderName: profile.displayName || 'User',
      senderJobId: profile.adminId || profile.clientId,
      text: newMessage.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'messages'), msgData);
      
      const convRef = doc(db, 'conversations', clientId);
      if (isAdmin) {
        await logGlobalAudit(profile, 'Send Message', 'system', `Sent message to client ${clientName}`, clientId, clientName);
      }
      const convSnap = await getDoc(convRef);
      
      const convUpdate: any = {
        lastMessage: newMessage.trim(),
        lastMessageAt: msgData.createdAt,
        updatedAt: msgData.createdAt
      };

      if (!isAdmin) {
        convUpdate.unreadCount = (convSnap.exists() ? (convSnap.data().unreadCount || 0) : 0) + 1;
      } else {
        sendNotification(
          clientId,
          t('NewMessageFromAdmin'),
          newMessage.trim().substring(0, 50) + (newMessage.trim().length > 50 ? '...' : ''),
          'info',
          '/portal/dashboard'
        );
      }

      if (!convSnap.exists()) {
        convUpdate.clientId = clientId;
        convUpdate.clientName = clientName;
        await setDoc(convRef, convUpdate);
      } else {
        await updateDoc(convRef, convUpdate);
      }

      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
            {clientName[0]}
          </div>
          <div>
            <h3 className="font-bold">{clientName}</h3>
            <p className="text-xs text-blue-100">{otherTyping ? t('Typing...') : t('Online')}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((msg) => (
          <div key={`chat-message-${msg.id}`} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
              msg.senderId === user?.uid 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 rounded-tl-none'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-[10px] mt-1 ${msg.senderId === user?.uid ? 'text-blue-100' : 'text-slate-400'}`}>
                {safeFormat(msg.createdAt, 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 rounded-tl-none">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-2 flex flex-col">
            <textarea
              value={newMessage}
              onChange={handleTyping}
              placeholder={t('TypeAMessage')}
              className="w-full bg-transparent border-none outline-none resize-none text-sm p-1 max-h-32 text-slate-900 dark:text-white"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                <Paperclip size={18} />
              </button>
              <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                <Image size={18} />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

const ChatSystem = () => {
  const { user, profile, isAdmin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (!user || !isAdmin) return;

    const q = query(
      collection(db, 'conversations'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'conversations'));

    return () => unsubscribe();
  }, [user, isAdmin]);

  const filteredConversations = conversations.filter(c => 
    c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="mb-4 w-80 md:w-96"
            >
              <ChatWindow 
                clientId={user?.uid || ''} 
                clientName={profile?.displayName || 'Me'} 
                onClose={() => setIsOpen(false)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 relative group"
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
          <span className="absolute right-full mr-4 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {t('ChatWithUs')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
        <div className="border-r border-slate-100 dark:border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('Messages')}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('SearchConversations')}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <div
                  key={`chat-conv-${conv.id}`}
                  onClick={() => setSelectedConv(conv)}
                  className={`p-4 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    selectedConv?.id === conv.id ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{conv.clientName}</h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {safeFormat(conv.lastMessageAt, 'HH:mm')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 mr-2">
                      {conv.lastMessage}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold">{t('NoConversations')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 flex flex-col">
          {selectedConv ? (
            <ChatWindow clientId={selectedConv.id} clientName={selectedConv.clientName} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl shadow-sm flex items-center justify-center mb-6">
                <MessageSquare size={40} className="opacity-20" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('SelectAConversation')}</h3>
              <p className="text-sm text-center max-w-xs">{t('SelectAConversationDesc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      markAsRead(n.id);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 hover:text-blue-600 transition-colors relative"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[9999] overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-900 dark:text-white">{t('Notifications')}</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    {t('MarkAllAsRead')}
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={`header-notif-${notif.id}`}
                      onClick={() => {
                        markAsRead(notif.id);
                        if (notif.link) {
                          navigate(notif.link);
                          setIsOpen(false);
                        }
                      }}
                      className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        !notif.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          notif.type === 'success' ? 'bg-green-100 text-green-600' :
                          notif.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                          notif.type === 'error' ? 'bg-red-100 text-red-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {notif.type === 'success' ? <CheckCircle size={20} /> :
                           notif.type === 'warning' ? <AlertTriangle size={20} /> :
                           notif.type === 'error' ? <AlertCircle size={20} /> :
                           <Bell size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold text-slate-900 dark:text-white ${!notif.read ? 'pr-4' : ''}`}>
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium">
                            {safeFormat(notif.createdAt, 'MMM d, HH:mm')}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 shrink-0" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <Bell size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold">{t('NoNotifications')}</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                <button className="text-xs text-slate-500 font-bold hover:text-blue-600 transition-colors">
                  {t('ViewAllNotifications')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminAnalytics = ({ users, appointments }: { users: UserProfile[], appointments: Appointment[] }) => {
  const { t } = useTranslation();
  
  const userGrowthData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), i);
      return format(date, 'MMM dd');
    }).reverse();

    return last30Days.map(day => {
      const count = users.filter(u => safeFormat(u.createdAt, 'MMM dd') === day).length;
      return { name: day, users: count };
    });
  }, [users]);

  const serviceDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(app => {
      counts[app.service] = (counts[app.service] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [appointments]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
            <BarChart3 size={20} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">{t('UserGrowth')}</h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl">
            <PieChartIcon size={20} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">{t('ServiceDistribution')}</h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={serviceDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {serviceDistributionData.map((entry, index) => (
                  <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- Pages ---
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, subDays, subHours, isSameDay, startOfDay, addHours, isAfter, parseISO, isToday, isYesterday, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks } from 'date-fns';

const calculateProratedBalance = (fullAmount: number, hireDateStr: string) => {
  try {
    const hireDate = new Date(hireDateStr + 'T00:00:00');
    if (isNaN(hireDate.getTime())) return fullAmount;
    
    const year = hireDate.getFullYear();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    const totalDaysInYear = 365;
    const diffTime = endOfYear.getTime() - hireDate.getTime();
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    if (remainingDays >= totalDaysInYear) return fullAmount;
    return Number(((fullAmount / totalDaysInYear) * remainingDays).toFixed(2));
  } catch (e) {
    return fullAmount;
  }
};
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// Error Boundary Component
const getFriendlyErrorMessage = (error: any, t: any) => {
  const message = error?.message || String(error);
  if (message.includes('Missing or insufficient permissions')) {
    return t('PermissionDenied') || 'You do not have permission to perform this action.';
  }
  if (error?.code === 'auth/email-already-in-use') {
    return t('EmailAlreadyInUse') || 'This email is already in use.';
  }
  if (error?.code === 'auth/weak-password') {
    return t('WeakPassword') || 'The password is too weak.';
  }
  if (error?.code === 'auth/invalid-email') {
    return t('InvalidEmail') || 'The email address is invalid.';
  }
  if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
    return t('InvalidCredentials') || 'Invalid email or password.';
  }
  return message;
};

const ErrorBoundary = class extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "{}");
        if (parsedError.error && parsedError.error.includes("Missing or insufficient permissions")) {
          errorMessage = "You do not have permission to access this resource. Please contact an administrator if you believe this is an error.";
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-2 border-blue-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Application Error</h1>
            <p className="text-slate-600 mb-8">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-200"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'New':
      return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    case 'Process':
      return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'Complete':
      return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700';
    case 'Cancelled':
      return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    default:
      return 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
};

const getAuditMetadata = (profile: UserProfile | null, action?: string): AuditMetadata | null => {
  if (!profile) return null;
  return {
    adminId: profile.adminId || profile.uid,
    adminName: profile.displayName || 'N/A',
    adminOfficeId: profile.officeCode || profile.officeId || 'N/A',
    timestamp: new Date().toISOString(),
    action: action || 'Action performed'
  };
};

const logGlobalAudit = async (adminProfile: any, action: string, category: 'service' | 'profile' | 'system' | 'access', details: string = '', targetId: string = '', targetName: string = '') => {
  if (!adminProfile) return;
  try {
    const auditData = {
      adminId: adminProfile.uid,
      adminName: adminProfile.displayName || 'N/A',
      adminOfficeId: adminProfile.officeCode || adminProfile.officeId || adminProfile.jobId || 'N/A',
      action,
      category,
      details,
      targetId,
      targetName,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'action_audits'), auditData);
  } catch (error) {
    console.error('Error logging global audit:', error);
  }
};

const getLastAction = (audit?: AuditMetadata | AuditMetadata[]) => {
  if (!audit) return '-';
  const audits = Array.isArray(audit) ? audit : [audit];
  if (audits.length === 0) return '-';
  const sorted = [...audits].sort((a, b) => {
    try {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } catch (e) {
      return 0;
    }
  });
  return sorted[0].action || '-';
};

const safeFormat = (date: any, formatStr: string) => {
  if (!date) return '';
  try {
    let d: Date;
    if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (date && typeof date.toDate === 'function') {
      // Handles Firestore Timestamp
      d = date.toDate();
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }

    if (isNaN(d.getTime())) return '';
    return format(d, formatStr);
  } catch (e) {
    console.error('safeFormat error:', e);
    return '';
  }
};

const AuditInfo = ({ audit }: { audit?: AuditMetadata | AuditMetadata[] }) => {
  const [show, setShow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const audits = useMemo(() => {
    if (!audit) return [];
    const rawAudits = Array.isArray(audit) ? audit : [audit];
    return [...rawAudits].sort((a, b) => {
      try {
        const timeA = a.timestamp && typeof (a.timestamp as any).toDate === 'function' 
          ? (a.timestamp as any).toDate().getTime() 
          : new Date(a.timestamp).getTime();
        const timeB = b.timestamp && typeof (b.timestamp as any).toDate === 'function' 
          ? (b.timestamp as any).toDate().getTime() 
          : new Date(b.timestamp).getTime();
        
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeB - timeA;
      } catch (e) {
        return 0;
      }
    });
  }, [audit]);

  if (!isAdmin || !audit) return null;

  const filteredAudits = audits.filter(a => {
    const term = (searchTerm || '').toLowerCase();
    return (a.adminName || '').toLowerCase().includes(term) ||
           (a.adminId || '').toLowerCase().includes(term) ||
           (a.adminOfficeId || '').toLowerCase().includes(term);
  });

  return (
    <div className="relative inline-block ml-1 align-middle">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setShow(true);
        }}
        className="p-1 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        title={t('ViewAuditInfo', 'View Action Details')}
      >
        <Eye size={14} />
      </button>

      <AnimatePresence>
        {show && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShow(false); }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-2xl tracking-tight">
                      {t('ActionDetails', 'Action Details')}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">{t('AuditLog', 'Audit Log History')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShow(false)}
                  className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input 
                    type="text"
                    placeholder={t('SearchByAdminNameOrID', 'Search by Admin Name or ID...')}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-600 rounded-[1.5rem] outline-none transition-all text-base font-medium shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
                {filteredAudits.length > 0 ? (
                  filteredAudits.map((item, index) => (
                    <motion.div 
                      key={`audit-log-${item.timestamp}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg border border-blue-100 dark:border-blue-800/30">
                            {item.adminName ? item.adminName[0] : '?'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white text-lg">{item.adminName || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('Administrator')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-xs font-bold">
                            <Clock size={14} />
                            {safeFormat(item.timestamp, 'MMM d, yyyy')}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{safeFormat(item.timestamp, 'HH:mm:ss')}</p>
                        </div>
                      </div>

                      {item.action && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Activity size={12} />
                            {item.action}
                          </p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50 dark:border-slate-700">
                        <div>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">{t('AdminID')}</span>
                          <p className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs truncate" title={item.adminId}>
                            {item.adminId}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">{t('OfficeID')}</span>
                          <p className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs truncate" title={item.adminOfficeId}>
                            {item.adminOfficeId}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <Search size={48} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-bold">{t('NoActionDetailsFound', 'No action details found matching your search.')}</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
                  {t('AuditLogSystem', 'Audit Log System')}
                </p>
                <p className="text-sm font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-full">
                  {audits.length} {t('Entries', 'Entries')}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const normalizeAudit = (audit: AuditMetadata | AuditMetadata[] | undefined): AuditMetadata[] => {
  if (!audit) return [];
  const raw = Array.isArray(audit) ? audit : [audit];
  return raw.filter((e): e is AuditMetadata => !!e && typeof e === 'object');
};


const SupervisionDataPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { supervisedId } = useParams();
  const { profile, isAdmin } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [superviseeSearchQuery, setSuperviseeSearchQuery] = useState('');
  const [globalAudits, setGlobalAudits] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [assignedServicesSearch, setAssignedServicesSearch] = useState('');
  const [auditLogSearch, setAuditLogSearch] = useState('');

  useEffect(() => {
    if (!profile?.uid) return;
    const qUsers = isAdmin 
      ? query(collection(db, 'users'), where('role', '==', 'admin'))
      : query(collection(db, 'users'), where('role', '==', 'admin'), where('supervisorId', '==', profile.uid));

    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const data = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setAdmins(data.filter(a => a.status !== 'paused'));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    
    // Appointments listener - filter for supervisors
    const qApps = isAdmin
      ? collection(db, 'appointments')
      : query(collection(db, 'appointments'), where('supervisorId', '==', profile.uid));

    const unsubApps = onSnapshot(qApps, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    }, (error) => {
      // Swallowing for appointments as it might not be strictly needed and avoids crashes
      console.warn('Appointments listener error:', error);
    });
    
    const unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
    
    return () => {
      unsubUsers();
      unsubApps();
      unsubAllUsers();
    };
  }, [profile?.uid, isAdmin]);

  useEffect(() => {
    if (!supervisedId) {
      setGlobalAudits([]);
      return;
    }
    const q = query(
      collection(db, 'action_audits'), 
      where('adminId', '==', supervisedId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setGlobalAudits(snap.docs.map(doc => doc.data()));
    }, () => {
      // Fallback if index missing or error
      setGlobalAudits([]);
    });
    return () => unsubscribe();
  }, [supervisedId]);

  const supervisedAdmin = useMemo(() => 
    supervisedId ? admins.find(a => a.uid === supervisedId) : null
  , [supervisedId, admins]);

  const allAudits = useMemo(() => {
    if (!supervisedAdmin) return [];
    
    // Normalize local audits
    const local = normalizeAudit(supervisedAdmin.audit).map(a => ({
      adminId: supervisedAdmin.uid,
      adminName: supervisedAdmin.displayName,
      adminOfficeId: supervisedAdmin.adminId || 'N/A',
      timestamp: a.timestamp,
      action: a.action || 'Action',
      details: a.details || '',
      isLocal: true
    }));

    // Map global audits
    const globalMapped = globalAudits.map(g => ({
      adminId: g.adminId,
      adminName: g.adminName,
      adminOfficeId: g.adminOfficeId,
      timestamp: g.timestamp,
      action: g.action,
      details: g.details,
      isGlobal: true
    }));
    
    const combined = [...local, ...globalMapped];
    const sorted = combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (!auditLogSearch.trim()) return sorted;
    const query = auditLogSearch.toLowerCase();
    return sorted.filter(a => 
      (a.action || '').toLowerCase().includes(query) || 
      (a.details || '').toLowerCase().includes(query) ||
      (a.adminName || '').toLowerCase().includes(query) ||
      (a.adminOfficeId || '').toLowerCase().includes(query)
    );
  }, [supervisedAdmin, globalAudits, auditLogSearch]);

  const assignedServices = useMemo(() => {
    if (!supervisedId) return [];
    const base = appointments.filter(app => app.assignedAdminId === supervisedId);
    if (!assignedServicesSearch.trim()) return base;
    const query = assignedServicesSearch.toLowerCase();
    return base.filter(app => 
      (app.service || '').toLowerCase().includes(query) ||
      (app.status || '').toLowerCase().includes(query) ||
      users.find(u => u.uid === app.clientId)?.displayName?.toLowerCase().includes(query)
    );
  }, [supervisedId, appointments, assignedServicesSearch, users]);

  if (loading || !profile) return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-600" size={32} /></div>;

  const assignedAdmins = admins.filter(a => a.role === 'admin' && a.status === 'active');

  const supervisedAdmins = admins.filter(a => a.role === 'admin' && a.supervisorId === profile.uid && a.status === 'active');
  const filteredSupervised = supervisedAdmins.filter(a => 
    (a.displayName || '').toLowerCase().includes(superviseeSearchQuery.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(superviseeSearchQuery.toLowerCase()) ||
    (a.adminId || '').toLowerCase().includes(superviseeSearchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('SupervisionData')}</h1>
            <p className="text-slate-500">{supervisedAdmin ? t('SuperviseeProfile') : t('SupervisedAdministrators')}</p>
            {!supervisedAdmin && (
              <h2 className="text-lg font-semibold text-slate-700 mt-2">{t('MyAdminsActionHistory', "My Administrators' Action History")}</h2>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {supervisedAdmin && (
            <AuditInfo audit={allAudits} />
          )}
          <button 
            onClick={() => supervisedAdmin ? navigate('/admin/supervision-data') : navigate('/admin')}
            className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all font-bold shadow-sm"
          >
            <ArrowLeft size={20} />
            <span>{t('Back')}</span>
          </button>
        </div>
      </div>

      {!supervisedAdmin ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder={t('SearchAdmins')}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
              value={superviseeSearchQuery}
              onChange={(e) => setSuperviseeSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSupervised.map(admin => (
              <div key={`supervision-admin-${admin.uid}`} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-blue-300 hover:bg-white transition-all duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-600 font-bold text-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {(admin.displayName || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{admin.displayName}</h3>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-200/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('AdminID')}</span>
                    <span className="text-xs font-mono font-bold text-blue-600">{admin.adminId}</span>
                  </div>
                  <button 
                    onClick={() => navigate(`/admin/supervision-data/${admin.uid}`)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                  >
                    <Eye size={14} />
                    {t('ViewDetails')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filteredSupervised.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Users size={40} />
              </div>
              <p className="text-slate-500 font-medium italic">{t('NoSupervisedAdmins')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center border-4 border-white shadow-xl relative overflow-hidden group">
                  <span className="text-3xl font-black">{(supervisedAdmin.displayName || '?').charAt(0)}</span>
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{supervisedAdmin.displayName}</h2>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {t('Administrator')}
                    </span>
                    <span className="text-sm font-medium text-slate-500">{supervisedAdmin.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200"
                >
                  <Edit2 size={20} />
                  {t('EditProfile')}
                </button>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[120px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('AdminID')}</p>
                  <p className="text-lg font-mono font-black text-blue-600">{supervisedAdmin.adminId}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Assigned Services History Block */}
            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow-2xl shadow-blue-100/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-[2.5rem] mb-8">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Briefcase className="text-blue-600" size={24} />
                      {t('AssignedServicesHistory', 'Assigned Services History')}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{t('AssignedServicesDesc', 'Real-time history of services assigned to this administrator.')}</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder={t('SearchServices')}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                    value={assignedServicesSearch}
                    onChange={(e) => setAssignedServicesSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Service')}</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Client')}</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Status')}</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('DueDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {assignedServices.map(app => (
                      <tr key={`assigned-service-hist-${app.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase text-sm">{app.service}</td>
                        <td className="px-6 py-4">
                           <span className="text-sm text-slate-600 dark:text-slate-400 font-bold">{users.find(u => u.uid === app.clientId)?.displayName || 'Unknown Client'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyles(app.status)}`}>
                            {t(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {app.dueDate ? safeFormat(app.dueDate, 'MMM d, yyyy') : t('NoDueDate')}
                        </td>
                      </tr>
                    ))}
                    {assignedServices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                          {t('NoAssignedServicesFound', 'No assigned services found.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comprehensive Audit Log History Block */}
            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow-2xl shadow-blue-100/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-[2.5rem] mb-8">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <History className="text-emerald-600" size={24} />
                      {t('AuditLogHistory', 'Audit Log History')}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{t('AuditLogDesc', 'Complete and real-time audit trail of all administrator actions.')}</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder={t('SearchAuditLogs')}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-sm"
                    value={auditLogSearch}
                    onChange={(e) => setAuditLogSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-6">
                <AuditInfo audit={allAudits} />
              </div>
            </div>
          </div>

          {showEditModal && (
            <EditEmployeeModal 
              key={`supervision-edit-${supervisedAdmin.uid}`}
              isOpen={showEditModal} 
              onClose={() => setShowEditModal(false)} 
              employee={supervisedAdmin} 
            />
          )}
        </div>
      )}
    </div>
  );
};

const LanguageSelector = ({ white = false }: { white?: boolean }) => {
  const { i18n } = useTranslation();
  const { updateLanguage, user } = useAuth();
  
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  const handleLanguageChange = (code: string) => {
    if (user) {
      updateLanguage(code);
    } else {
      i18n.changeLanguage(code);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${white ? 'bg-white/20 border-white/30' : 'bg-white/80 dark:bg-slate-800/80 border-blue-500'} backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm transition-colors duration-300`}>
      <Globe size={14} className={white ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
      <select
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer ${white ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

// --- Types ---

const VIPBadge = ({ userId }: { userId: string }) => {
  const [referralCount, setReferralCount] = useState(0);
  const [isManualVIP, setIsManualVIP] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const unsubUser = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setIsManualVIP(snap.data().isManualVIP || false);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${userId}`));

    const q = query(collection(db, 'users'), where('referrerId', '==', userId));
    const unsubReferrals = onSnapshot(q, (snapshot) => {
      setReferralCount(snapshot.size);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => {
      unsubUser();
      unsubReferrals();
    };
  }, [userId]);

  if (referralCount < 25 && !isManualVIP) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-black text-amber-500 tracking-wider">VIP</span>
      <Crown size={14} className="text-amber-500 fill-amber-500" />
    </div>
  );
};

// --- Main App ---







const DocumentsView = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [files, setFiles] = useState<SharedFile[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'shared_files'),
      where('recipientId', '==', profile.uid),
      orderBy('uploadedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedFile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shared_files'));
    return unsubscribe;
  }, [profile?.uid]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-slate-900">{t('Documents')}</h1>
        <p className="text-sm md:text-base text-slate-500">{t('DocumentsDesc', 'View and download documents shared with you by administrators.')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <FileIcon className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">{t('NoDocumentsFound', 'No documents found.')}</p>
          </div>
        ) : (
          files.map(file => (
            <div key={`expert-file-card-${file.id}`} className="bg-white p-4 rounded-xl shadow-sm border-2 border-blue-100 hover:shadow-md transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <FileIcon size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-bold text-slate-900 truncate" title={file.name}>{file.name}</h3>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 font-medium">
                  {safeFormat(file.uploadedAt, 'PP')}
                </span>
                <div className="flex gap-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                    title={t('View')}
                  >
                    <Eye size={16} />
                  </a>
                  <a
                    href={file.url}
                    download={file.name}
                    className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                    title={t('Download')}
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Utils ---
const getServiceFee = (service: string): number => {
  const feeMatch = service.match(/\$(\d+(\.\d+)?)/);
  return feeMatch ? parseFloat(feeMatch[1]) : 0;
};

const generateClientId = (name: string, dob: string) => {
  if (!name || !dob) return '';
  const firstLetter = name.trim().charAt(0).toUpperCase();
  const dateParts = dob.split('-'); // YYYY-MM-DD
  if (dateParts.length !== 3) return '';
  const day = dateParts[2];
  const year = dateParts[0];
  return `${firstLetter}${day}${year}`;
};

const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- Components ---

const Logo = ({ size = 'w-24 h-24', showText = true }: { size?: string, showText?: boolean }) => {
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'branding', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setLogoUrl(docSnap.data().logoUrl);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'branding/config'));
    return unsubscribe;
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit for logo
      toast.error('Logo too large (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const path = 'branding/config';
      try {
        await setDoc(doc(db, 'branding', 'config'), {
          logoUrl: base64,
          updatedAt: new Date().toISOString()
        });
        toast.success('Logo updated');
      } catch (error) {
        console.error(error);
        toast.error('Failed to update logo. Check permissions.');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        className={`${size} rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all ${
          isAdmin ? 'cursor-pointer hover:border-blue-500 border-slate-700' : 'border-transparent'
        } bg-slate-800/50 relative group`}
        onClick={() => isAdmin && fileInputRef.current?.click()}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Camera size={24} />
            {isAdmin && <span className="text-[10px] font-bold uppercase tracking-tighter">{t('UploadLogo')}</span>}
          </div>
        )}
        {isAdmin && logoUrl && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{t('ChangeLogo')}</span>
          </div>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleLogoUpload} 
        className="hidden" 
        accept="image/*"
      />
      {showText && (
        <div className="flex flex-col items-center">
          <h3 className="text-[32px] font-bold text-slate-500 uppercase tracking-[0.2em] text-center whitespace-nowrap">{t('ClientPathways')}</h3>
          <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.1em] mt-1 text-center whitespace-nowrap">{t('GlobalExperts')}</h2>
        </div>
      )}
    </div>
  );
};

const ThemeToggle = () => {
  const { profile, toggleTheme } = useAuth();
  const { t } = useTranslation();
  const currentTheme = profile?.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-blue-500 shadow-sm transition-all hover:scale-110"
      title={currentTheme === 'dark' ? t('LightMode') : t('DarkMode')}
    >
      {currentTheme === 'dark' ? (
        <Sun size={18} className="text-yellow-500" />
      ) : (
        <Moon size={18} className="text-blue-600" />
      )}
    </button>
  );
};

const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) => {
  const { isAdmin, isEmployee, isClient, profile, user, canEdit, userTypeLabel } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSignaturesCount, setPendingSignaturesCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'signature_requests'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingSignaturesCount(snapshot.size);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'signature_requests'));
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (profile?.role === 'admin' && location.pathname.startsWith('/admin')) {
      logGlobalAudit(profile, 'Page Visit', 'system', `Visited page: ${location.pathname}`);
    }
  }, [location.pathname, profile?.uid]);

  const handleLogout = async () => {
    if (profile) {
      await logGlobalAudit(profile, 'Logout', 'system', 'User logged out of the application');
    }
    await signOut(auth);
    navigate('/login');
  };

  const navItems = isAdmin ? [
    { name: t('Home'), icon: Globe, path: '/portal' },
    { name: t('Dashboard'), icon: LayoutDashboard, path: '/admin' },
    { name: t('OfficesAndAdmins'), icon: Lock, path: '/admin/offices-and-admins' },
    { name: t('Users'), icon: Users, path: '/admin/users' },
    { name: t('ServicesAndClasses'), icon: Settings, path: '/admin/services' },
    { name: t('Resources'), icon: FolderIcon, path: '/portal/resources' },
    { name: t('SalesTeam'), icon: Users, path: '/portal/sales-team' },
    { name: t('Contractors'), icon: Briefcase, path: '/admin/contractors' },
    { name: t('ThirdPartyReferrals'), icon: Search, path: '/admin/referrals' },
    { name: t('TeamPortalSystem'), icon: Briefcase, path: '/portal/team-portal' },
    { name: t('FormsBank'), icon: FileText, path: '/admin/forms-bank' },
    { name: t('AdministratorCalendar'), icon: CalendarDays, path: '/admin/calendar' },
    { name: t('Payments'), icon: CreditCard, path: '/admin/payments' },
    { name: t('Signatures'), icon: PenTool, path: '/admin/signatures' },
    { name: t('MyProfile'), icon: UserIcon, path: '/profile' },
  ] : isEmployee ? [
    { name: t('RequestTimeOff'), icon: CalendarDays, path: '/portal/team-portal#request-time-off' },
    { name: t('TimeOffRequests'), icon: History, path: '/portal/team-portal#time-off-requests' },
    { name: t('MyBenefits'), icon: Gift, path: '/portal/team-portal#my-benefits' },
    { name: t('MyDocuments'), icon: FileText, path: '/portal/team-portal#my-documents' },
    { name: t('AttendanceHistory'), icon: History, path: '/portal/team-portal#attendance-history' },
    { name: t('PayStatements'), icon: CreditCard, path: '/portal/team-portal#pay-statements' },
    { name: t('TaxDocuments'), icon: FileText, path: '/portal/team-portal#tax-documents' },
  ] : [
    { name: t('Home'), icon: LayoutDashboard, path: '/portal' },
    { name: t('ServiceHistory'), icon: History, path: '/portal/appointments' },
    { name: t('ScheduleAnAppointment'), icon: CalendarDays, path: '/portal/calendar' },
    { name: t('Payments'), icon: CreditCard, path: '/portal/payments' },
    { name: t('Documents'), icon: FileIcon, path: '/portal/documents' },
    { name: t('Signatures'), icon: PenTool, path: '/portal/signatures' },
    { name: t('MyProfile'), icon: UserIcon, path: '/profile' },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNavClick = (name: string, path: string) => {
    if (path === '/admin/offices-and-admins' || path === '/admin/services') {
      setPendingPath(path);
      setPromptTitle(name);
      setShowWarning(true);
    } else if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      if (window.location.hash.includes(basePath)) {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          if (onClose) onClose();
        }
      } else {
        navigate(path);
        if (onClose) onClose();
      }
    } else {
      navigate(path);
      if (onClose) onClose();
    }
  };

  const handleWarningSuccess = () => {
    if (pendingPath) {
      navigate(pendingPath);
      if (onClose) onClose();
    }
    setPendingPath(null);
    setShowWarning(false);
  };

  return (
    <>
      <WarningGateModal 
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onSuccess={handleWarningSuccess}
        title={promptTitle}
      />
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col p-6 transition-transform duration-300 lg:relative lg:translate-x-0 lg:h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="mb-8 flex flex-col items-center">
          <Logo size="w-32 h-32" />
          <div className="mt-4 w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder={t('SearchTabs', 'Search tabs...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center justify-end mb-6 lg:hidden">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <button
              key={`nav-item-${item.path}`}
              onClick={() => handleNavClick(item.name, item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white relative"
            >
              <item.icon size={20} className="text-blue-500" />
              <span className="font-medium">{item.name}</span>
              {item.name === t('Signatures') && pendingSignaturesCount > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg">
                  {pendingSignaturesCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="px-4 mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0 relative group">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <UserIcon size={20} />
                </div>
              )}
              {isAdmin && (
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={14} />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !profile) return;
                      if (file.size > 500000) {
                        toast.error(t('FileTooLarge'));
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                          await updateDoc(doc(db, 'users', profile.uid), { photoURL: base64 });
                          toast.success(t('PhotoUpdated'));
                        } catch (err) {
                          console.error("Photo update failed:", err);
                          toast.error("Failed to update photo");
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{t('LoggedInAs')}</p>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-white truncate">
                  {profile?.displayName || user?.displayName}
                </p>
                {userTypeLabel && (
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter leading-none mt-0.5">
                    {isEmployee ? t('employee') : userTypeLabel}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-1">{profile?.email || user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors mt-2"
          >
            <LogOut size={20} />
            <span className="font-medium">{t('Logout')}</span>
          </button>
        </div>
      </div>
    </>
  );
};

const ReferralLink = () => {
  const { profile, isClient } = useAuth();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!profile || !isClient) return null;

  const getBaseUrl = () => {
    const { origin, pathname } = window.location;
    // Ensure we have a clean base URL without trailing slashes or hash
    const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${origin}${cleanPath}`;
  };

  const referralLink = `${getBaseUrl()}#/login?ref=${profile.referralCode || profile.dob}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(t('LinkCopied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg animate-in fade-in slide-in-from-right-4">
      <div className="flex flex-col">
        <span className="text-[8px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider leading-none mb-0.5">
          {t('ReferralLink')}
        </span>
        <span className="hidden sm:inline text-xs font-mono text-slate-600 dark:text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
          {referralLink}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="p-1 sm:p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md text-blue-600 dark:text-blue-400 transition-colors"
        title={t('CopyLink')}
      >
        {copied ? <Check size={14} className="sm:w-4 sm:h-4" /> : <Copy size={14} className="sm:w-4 sm:h-4" />}
      </button>
    </div>
  );
};

const WarningGateModal = ({ isOpen, onClose, onSuccess, title }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, title: string }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-yellow-200 dark:border-yellow-900/50 overflow-hidden">
        <div className="p-8">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-4">{title}</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-xl mb-8">
            <p className="text-center text-yellow-800 dark:text-yellow-200 font-bold leading-relaxed">
              {t('AuthorizedManagersOnly')}
            </p>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={onSuccess}
              className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-yellow-200 dark:shadow-none"
            >
              {t('IAmAuthorized')}
            </button>
            <button 
              onClick={onClose}
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              {t('CancelNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const YellowWarningModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText,
  cancelText,
  requireReason = false
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (reason?: string) => void, 
  title: string, 
  message: string,
  confirmText?: string,
  cancelText?: string,
  requireReason?: boolean
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      toast.error(t('ReasonRequired') || 'Cancellation reason is required');
      return;
    }
    onConfirm(reason);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-yellow-200 dark:border-yellow-900/50 overflow-hidden">
        <div className="p-8">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-4">{title}</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-xl mb-6">
            <p className="text-center text-yellow-800 dark:text-yellow-200 font-bold leading-relaxed">
              {message}
            </p>
          </div>

          {requireReason && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {t('CancellationReason')} *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all text-sm"
                placeholder={t('EnterCancellationReason') || "Enter reason for cancellation..."}
                rows={3}
                required
              />
            </div>
          )}
          
          <div className="space-y-3">
            <button 
              onClick={handleConfirm}
              className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-yellow-200 dark:shadow-none"
            >
              {confirmText || t('Confirm')}
            </button>
            <button 
              onClick={() => {
                setReason('');
                onClose();
              }}
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              {cancelText || t('Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditRequestedServiceModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  appointment: Appointment | null;
  onConfirm: (newName: string, newPrice: string) => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (appointment) {
      const serviceStr = appointment.service;
      const priceMatch = serviceStr.match(/\$(\d+(\.\d+)?)/);
      const currentPrice = priceMatch ? priceMatch[1] : '';
      const currentName = serviceStr.replace(/\s*-\s*\$\d+(\.\d+)?/, '').replace(/\s*\$\d+(\.\d+)?/, '').trim();
      
      setName(currentName);
      setPrice(currentPrice);
    }
  }, [appointment]);

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('EditRequestedService')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('ServiceName')}</label>
            <input 
              type="text"
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('Price')} ($)</label>
            <input 
              type="text"
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t('Cancel')}
          </button>
          <button 
            onClick={() => onConfirm(name, price)}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            {t('SaveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

const WarningGate = ({ children, title }: { children: React.ReactNode, title: string }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const navigate = useNavigate();

  if (isUnlocked) return <>{children}</>;

  return (
    <WarningGateModal 
      isOpen={showPrompt}
      onClose={() => navigate(-1)}
      onSuccess={() => setIsUnlocked(true)}
      title={title}
    />
  );
};

const Footer = () => {
  const { t } = useTranslation();
  const [showTerms, setShowTerms] = useState(false);

  const termsText = `About the general use of this site

This site and its entire content are the property of Global Experts LLC. They are made available only for business information purposes and are subject to being updated or changed without notice to any party. Information and other items on this site can be copied or used by other parties only in part. The use is allowed only for personal needs and with the intent to do business with the firm.
By accessing this website, you automatically agree to our present and future Terms and Conditions and Privacy Policy determined by the firm. 

Similarly, by entering any of your information on this website, you automatically consent to our use of your information for business and other legal purposes. By sharing your phone number and email address on this website, you consent to receive text messages, phone calls, and emails from the firm for business purposes and promotional offers.
Furthermore, you consent to resolving any related litigation only by mutual agreement and mediation. You also consent that information on this website cannot be used as evidence against the firm in any instance, including but not limited to judicial or political instances.

About the services and other resources exhibited on the site

Information about services and other resources made available on this website might only sometimes be an exact reflection of specific terms and conditions in which these services and resources will be delivered. You acknowledge that all that information regarding services and other resources might vary in part or in whole depending on specific clients’ needs and preferences.

About the interpretation of the information available on this site

Only the firm has the right to determine the final interpretation of any portion or entire content of this website. All third-party’s interpretations of part or whole of the information on this website are pure assumptions and will be offset by any contradictory interpretation of the firm.

About the use of Artificial intelligence on this website

The original language of this website is American English, and we use artificial Intelligence (AI) to translate the content of this website into other languages. By visiting this website, interacting on this website, and more, you automatically consent to our use of IA on the website, and you consent not to hold the firm accountable for the imperfection of AI if noticed on this website.

Consent to Text, Email, and phone call communication

By sharing your phone number and email address on this website, you automatically consent to receive text messages, phone calls, and emails from Global Experts LLC for business purposes and promotional offers.`;

  return (
    <footer className="bg-blue-600 text-white p-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm">{t('Copyright', 'Copyright © 2026 Global Experts LLC. All rights reserved.')}</p>
        <button 
          onClick={() => setShowTerms(true)}
          className="text-sm font-bold hover:underline"
        >
          {t('TermsAndConditions', 'Terms and Conditions')}
        </button>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('TermsAndConditions', 'Terms and Conditions')}</h2>
              <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 overflow-y-auto text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {t('TermsText', termsText)}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowTerms(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                {t('Close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </footer>
  );
};

const getTourScript = (path: string, isAdmin: boolean, t: any) => {
  const isClientPortal = path.startsWith('/portal');
  
  if (isClientPortal) {
    if (path === '/portal') {
      return t('TourPortalHome');
    }
    if (path === '/portal/dashboard') {
      return t('TourPortalDashboard');
    }
    if (path === '/portal/appointments') {
      return t('TourPortalAppointments');
    }
    if (path === '/portal/documents') {
      return t('TourPortalDocuments');
    }
    return t('TourPortalGeneric');
  } else {
    if (path === '/admin') {
      return t('TourAdminHome');
    }
    if (path === '/admin/users') {
      return t('TourAdminUsers');
    }
    if (path === '/admin/services') {
      return t('TourAdminServices');
    }
    if (path === '/admin/signatures') {
      return t('TourAdminSignatures');
    }
    return t('TourAdminGeneric');
  }
};

const VoiceTour = () => {
  const { pathname } = useLocation();
  const { isAdmin, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);

  useEffect(() => {
    if (i18n.language !== 'en') {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Check for 72-hour lockout if tour was stopped
    const stoppedAt = localStorage.getItem('voice_tour_stopped_at');
    if (stoppedAt) {
      const hoursSinceStop = (Date.now() - parseInt(stoppedAt)) / 3600000;
      if (hoursSinceStop < 72) {
        setIsPlaying(false);
        return;
      }
    }
    
    setStopRequested(false);
    const visitCounts = JSON.parse(localStorage.getItem('voice_tour_visits') || '{}');
    const count = visitCounts[pathname] || 0;
    
    const playTour = () => {
      const script = getTourScript(pathname, isAdmin, t);
      const intro = t('TourIntro');
      const outro = t('TourOutro');
      const fullText = `${intro} ${script} ${outro}`;
      
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = i18n.language;
      
      // Select a male voice
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('david') || 
        v.name.toLowerCase().includes('microsoft james') ||
        v.name.toLowerCase().includes('google us english')
      );
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.9; // Slightly lower pitch for a more masculine feel
      utterance.rate = 0.95; // Slightly slower for clarity
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    };

    const playWelcomeBack = () => {
      const text = t('TourWelcomeBack');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = i18n.language;
      
      // Select a male voice
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('david') || 
        v.name.toLowerCase().includes('microsoft james') ||
        v.name.toLowerCase().includes('google us english')
      );
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.9;
      utterance.rate = 0.95;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    };

    const timer = setTimeout(() => {
      if (count < 3) {
        playTour();
      } else if (pathname === '/portal' && !isAdmin) {
        playWelcomeBack();
      }
    }, 1500);

    visitCounts[pathname] = count + 1;
    localStorage.setItem('voice_tour_visits', JSON.stringify(visitCounts));

    return () => {
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, [pathname, isAdmin, t]);

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setStopRequested(true);
    localStorage.setItem('voice_tour_stopped_at', Date.now().toString());
  };

  if (!isPlaying) return null;

  return (
    <div className="bg-blue-600/10 dark:bg-blue-400/10 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-blue-200 dark:border-blue-800 sticky top-[73px] z-20">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-blue-200 dark:shadow-none">
          <Sparkles size={16} />
        </div>
        <div>
          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Opery Voice</p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('TourInProgress', 'Page tour in progress...')}</p>
        </div>
      </div>
      <button 
        onClick={handleStop}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 transition-all shadow-lg shadow-red-200 dark:shadow-none active:scale-95"
      >
        <Pause size={14} />
        {t('StopTour', 'STOP TOUR')}
      </button>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useTranslation();
  const { profile, userTypeLabel } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 h-screen overflow-hidden transition-colors duration-300">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="bg-blue-600 border-b border-blue-500 p-4 flex justify-between items-center sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-2 md:gap-3 justify-start overflow-hidden">
            <button 
              onClick={() => navigate(-1)}
              className="p-1.5 md:p-2 hover:bg-blue-700 rounded-lg text-white transition-colors flex items-center gap-1 md:gap-2 flex-shrink-0"
              title={t('Back')}
            >
              <ArrowLeft size={18} className="md:w-5 md:h-5" />
              <span className="hidden sm:inline text-xs md:text-sm font-medium">{t('Back')}</span>
            </button>
            <div className="hidden md:flex lg:hidden items-center gap-2 flex-shrink-0">
              <Logo size="w-6 h-6 md:w-8 md:h-8" showText={false} />
              <h1 className="font-bold text-white text-[20px] md:text-[24px] truncate"><b>{t('ClientPathways')}</b></h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-4 justify-end">
            <ReferralLink />
            <LanguageSelector white />
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 md:p-2 hover:bg-blue-700 rounded-lg text-white flex-shrink-0"
            >
              <Menu size={20} className="md:w-6 md:h-6" />
            </button>
          </div>
        </header>
        <VoiceTour />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col p-4 md:p-8">
            <div className="flex-1 mb-20">
              {children}
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
};

// --- Pages ---

const EmployeeLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        if (!userData.isEmployee) {
          await signOut(auth);
          toast.error(t('PortalForEmployeesOnly', 'This portal is for employees only.'));
          setLoading(false);
          return;
        }
        if (userData.status === 'blocked') {
          await signOut(auth);
          toast.error(t('AccountBlockedContactSupport', 'Your account has been blocked. Please contact support.'));
          setLoading(false);
          return;
        }

        toast.success(t('WelcomeToEmployeePortal', 'Welcome to the Employee Portal!'));
        navigate('/portal/team-portal');
      } else {
        await signOut(auth);
        toast.error(t('EmployeeProfileNotFound', 'Employee profile not found.'));
      }
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-emerald-500"
      >
        <div className="text-center mb-8">
          <Logo size="w-24 h-24" />
          <p className="text-slate-500 dark:text-slate-400 mt-2">{t('EmployeePortal')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('PersonalEmail')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('PortalPassword')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <LogIn size={20} />}
            {t('Login')}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error('Please enter your email address first.');
                  return;
                }
                try {
                  await sendPasswordResetEmail(auth, email.trim());
                  toast.success(t('PasswordResetSent', { email: email.trim() }));
                } catch (error: any) {
                  toast.error(error.message);
                }
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {t('ForgotPassword')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [dob, setDob] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('en');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [country, setCountry] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isReset, setIsReset] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const ref = queryParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      setIsRegister(true);
    }
  }, [location.search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
      
      // Check if user is in deleted_users or deleted_admins
      try {
        const [deletedUserDoc, deletedAdminDoc] = await Promise.all([
          getDoc(doc(db, 'deleted_users', user.uid)),
          getDoc(doc(db, 'deleted_admins', user.uid))
        ]);

        if (deletedUserDoc.exists() || deletedAdminDoc.exists()) {
          await signOut(auth);
          toast.error(t('AccountRevokedOrDeleted', 'Your account has been revoked or deleted. Please contact support.'));
          setLoading(false);
          return;
        }
      } catch (checkError) {
        console.warn("Account status check failed:", checkError);
      }

      // Check if user is blocked or is an employee
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          if (userData.status === 'blocked' || (userData.role === 'admin' && userData.status === 'paused')) {
            await signOut(auth);
            toast.error(userData.status === 'paused' 
              ? t('AdminAccountPaused', 'Your administrator account is currently paused. Please contact the Super Admin.') 
              : t('AccountBlocked', 'Your account has been blocked. Please contact support.'));
            setLoading(false);
            return;
          }
          if (userData.role === 'employee') {
            await signOut(auth);
            toast.error(t('EmployeesUseEmployeePortal', 'Employees must log in through the Employee Portal.'));
            setLoading(false);
            return;
          }
        }
      } catch (userDocError) {
        console.warn("User profile check failed:", userDocError);
      }

      toast.success(t('WelcomeBack', 'Welcome back!'));
      navigate('/');
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  const validatePhone = (value: string) => {
    // Simple regex for common phone formats: +1 (555) 000-0000, 555-000-0000, 5550000000, etc.
    const phoneRegex = /^(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}$/;
    if (!value) {
      setPhoneError(t('PhoneRequired'));
      return false;
    }
    if (!phoneRegex.test(value)) {
      setPhoneError(t('InvalidPhoneFormat'));
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhone(phone)) {
      toast.error(t('InvalidPhoneFormat'));
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    
    try {
      // Check if user was previously deleted - wrap in try/catch as it might fail for unauthenticated users
      let deletedUserDoc: any = null;
      try {
        const qDeleted = query(collection(db, 'deleted_users'), where('email', '==', trimmedEmail), limit(1));
        const deletedSnapshot = await getDocs(qDeleted);
        
        if (!deletedSnapshot.empty) {
          deletedUserDoc = deletedSnapshot.docs[0];
          const deletedData = deletedUserDoc.data();
          const oldPhone = deletedData.originalData?.phoneNumber || deletedData.phoneNumber;
          if (oldPhone === phone) {
            toast.error(t('AccountDeletedSamePhoneError'));
            setLoading(false);
            return;
          }
        }
      } catch (deletedCheckError) {
        console.warn("Deleted user check skipped:", deletedCheckError);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      // Update Auth profile with full name
      await updateProfile(user, { displayName: fullName });
      
      // Check for referral
      let referrerInfo = {};
      if (referralCode) {
        try {
          const usersRef = collection(db, 'users');
          // Try querying by referralCode first, then fallback to dob for legacy links
          let qRef = query(usersRef, where('referralCode', '==', referralCode), limit(1));
          let referrerSnap = await getDocs(qRef);
          
          if (referrerSnap.empty) {
            // Fallback for legacy links using dob
            qRef = query(usersRef, where('dob', '==', referralCode), limit(1));
            referrerSnap = await getDocs(qRef);
          }

          if (!referrerSnap.empty) {
            const referrerData = referrerSnap.docs[0].data() as UserProfile;
            referrerInfo = {
              referrerId: referrerData.uid,
              referrerName: referrerData.displayName,
              referrerClientId: referrerData.clientId
            };
            toast.success(`Referral applied: ${referrerData.displayName}`);
          } else {
            console.warn("Referral code not found:", referralCode);
          }
        } catch (refError) {
          console.error("Referral lookup failed:", refError);
          // Don't throw here to allow registration to complete even if referral fails
        }
      }

      // Check if a profile with this email already exists (pre-registered or restored)
      let querySnapshot;
      try {
        const q = query(collection(db, 'users'), where('email', '==', trimmedEmail), limit(1));
        querySnapshot = await getDocs(q);
      } catch (qError) {
        console.warn("Existing profile lookup failed:", qError);
      }
      
      let newProfile: UserProfile;
      const clientId = generateClientId(fullName, dob);
      
        if (querySnapshot && !querySnapshot.empty) {
          // Use the existing profile data
          const existingDoc = querySnapshot.docs[0];
          const existingData = existingDoc.data() as UserProfile;
          const oldUid = existingData.uid;

          // Merge related collections from oldUid to new uid
          try {
            // 1. Update appointments
            const qApps = query(collection(db, 'appointments'), where('clientId', '==', oldUid));
            const appsSnap = await getDocs(qApps);
            const appUpdates = appsSnap.docs.map(d => updateDoc(doc(db, 'appointments', d.id), { clientId: user.uid }));
            await Promise.all(appUpdates);
          } catch (e) { console.warn("Failed to merge appointments:", e); }

          try {
            // 2. Update user_custom_services
            const qCustom = query(collection(db, 'user_custom_services'), where('clientId', '==', oldUid));
            const customSnap = await getDocs(qCustom);
            const customUpdates = customSnap.docs.map(d => updateDoc(doc(db, 'user_custom_services', d.id), { clientId: user.uid }));
            await Promise.all(customUpdates);
          } catch (e) { console.warn("Failed to merge custom services:", e); }

          try {
            // 3. Update referrals
            const qReferred = query(collection(db, 'users'), where('referrerId', '==', oldUid));
            const referredSnap = await getDocs(qReferred);
            const referredUpdates = referredSnap.docs.map(d => updateDoc(doc(db, 'users', d.id), { referrerId: user.uid }));
            await Promise.all(referredUpdates);
          } catch (e) { console.warn("Failed to merge referrals:", e); }

          newProfile = {
            ...existingData,
            uid: user.uid,
            email: trimmedEmail,
            displayName: fullName || existingData.displayName,
            phoneNumber: phone || existingData.phoneNumber,
            dob: dob || existingData.dob,
            streetAddress: streetAddress || existingData.streetAddress,
            city: city || existingData.city,
            stateProvince: stateProvince || existingData.stateProvince,
            country: country || existingData.country,
            zipCode: zipCode || existingData.zipCode,
            clientId: clientId || existingData.clientId,
            status: 'active',
            createdAt: existingData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            primaryLanguage: primaryLanguage,
            referralCode: existingData.referralCode || generateReferralCode(),
            ...referrerInfo
          };
          // Delete the old document
          try {
            await deleteDoc(existingDoc.ref);
          } catch (deleteError) {
            console.error(deleteError);
          }
        } else {
          // Create a new client profile
          newProfile = {
            uid: user.uid,
            email: trimmedEmail,
            displayName: fullName,
            phoneNumber: phone,
            dob: dob,
            streetAddress: streetAddress,
            city: city,
            stateProvince: stateProvince,
            country: country,
            zipCode: zipCode,
            clientId: clientId,
            primaryLanguage: primaryLanguage,
            role: 'client',
            status: 'active',
            activeFlag: 'green',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            referralCode: generateReferralCode(),
            ...referrerInfo
          };
        }
      
      // Create the user profile document
      try {
        if (deletedUserDoc) {
          const deletedData = deletedUserDoc.data();
          const oldUid = deletedData.uid;
          
          // Merge data from deleted_users: Update appointments
          try {
            const qApps = query(collection(db, 'appointments'), where('clientId', '==', oldUid));
            const appsSnap = await getDocs(qApps);
            const appUpdates = appsSnap.docs.map(d => updateDoc(doc(db, 'appointments', d.id), { clientId: user.uid }));
            await Promise.all(appUpdates);
          } catch (e) { console.warn("Failed to merge appointments from deleted user:", e); }

          // Merge data from deleted_users: Update user_custom_services
          try {
            const qCustom = query(collection(db, 'user_custom_services'), where('clientId', '==', oldUid));
            const customSnap = await getDocs(qCustom);
            const customUpdates = customSnap.docs.map(d => updateDoc(doc(db, 'user_custom_services', d.id), { clientId: user.uid }));
            await Promise.all(customUpdates);
          } catch (e) { console.warn("Failed to merge custom services from deleted user:", e); }

          // Merge data from deleted_users: Update referrals
          try {
            const qReferred = query(collection(db, 'users'), where('referrerId', '==', oldUid));
            const referredSnap = await getDocs(qReferred);
            const referredUpdates = referredSnap.docs.map(d => updateDoc(doc(db, 'users', d.id), { referrerId: user.uid }));
            await Promise.all(referredUpdates);
          } catch (e) { console.warn("Failed to merge referrals from deleted user:", e); }

          // Restore profile data from originalData if it exists
          if (deletedData.originalData) {
            newProfile = {
              ...deletedData.originalData,
              ...newProfile, // Overwrite with new registration data
              uid: user.uid,
              role: 'client', // Robust barrier: Always register as client
              status: 'active',
              activeFlag: deletedData.originalData.activeFlag || 'green',
              updatedAt: new Date().toISOString()
            };
          }

          // Delete from deleted_users
          await deleteDoc(deletedUserDoc.ref);
          toast.success(t('UserRestoredSuccessfully', { name: newProfile.displayName }));
        }

        await setDoc(doc(db, 'users', user.uid), newProfile);
      } catch (setError) {
        console.error(setError);
      }
      
      if (!deletedUserDoc) {
        toast.success('Account created successfully!');
      }
      navigate('/');
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      toast.success(t('PasswordResetSent', { email: trimmedEmail }));
      setIsReset(false);
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isReset) return t('ResetTitle');
    if (isRegister) return t('RegisterTitle');
    return t('LoginTitle');
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isReset) return handleReset(e);
    if (isRegister) return handleRegister(e);
    return handleLogin(e);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="mb-8">
        <LanguageSelector />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-md border-2 border-blue-500 transition-colors duration-300"
      >
        <div className="text-center mb-8">
          <Logo size="w-24 h-24" />
          <p className="text-slate-500 dark:text-slate-400 mt-2">{getTitle()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('FullName')} <span className="text-xs font-normal text-slate-500">{t('FullNameDetail')}</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder={t('FullName')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('PhoneNumber')}</label>
                  <div className="relative">
                    <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 ${phoneError ? 'text-red-400' : 'text-slate-400'}`} size={18} />
                    <input
                      type="tel"
                      required
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none ${phoneError ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'}`}
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      onBlur={(e) => validatePhone(e.target.value)}
                    />
                  </div>
                  {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('DateOfBirth')}</label>
                  <div className="relative">
                    <Cake className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="date"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('PrimaryLanguage')}</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                      value={primaryLanguage}
                      onChange={(e) => setPrimaryLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="pt">Português</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('StreetAddress')}</label>
                <div className="relative">
                  <HomeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="123 Main St"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('City')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="New York"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('ZipCode')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="10001"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('StateProvince')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="NY"
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('Country')}</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="USA"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {!isReset && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isRegister ? t('CreatePassword') : t('Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="w-full pl-10 pr-12 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={isRegister ? t('CreatePassword') : t('Password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('Processing') : (isReset ? t('Reset') : (isRegister ? t('Register') : t('Login')))}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center">
          {!isReset && (
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setIsReset(false);
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              {isRegister ? t('HaveAccount') : t('NoAccount')}
            </button>
          )}
          <button
            onClick={() => {
              setIsReset(!isReset);
              setIsRegister(false);
            }}
            className="text-sm text-slate-500 hover:underline"
          >
            {isReset ? t('BackToLogin') : t('ForgotPassword')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Admin Pages ---

// --- Pages ---

// --- Communication Options Component ---
const FlagSystem = ({ targetUser, onUpdate }: { targetUser: UserProfile, onUpdate: (updatedUser: UserProfile) => void }) => {
  const { t } = useTranslation();
  const { profile, isAdmin } = useAuth();
  const [editingFlag, setEditingFlag] = useState<'green' | 'yellow' | 'red' | null>(null);
  const [viewingFlag, setViewingFlag] = useState<'green' | 'yellow' | 'red' | null>(null);
  const [noteText, setNoteText] = useState('');

  if (!isAdmin) return null;

  const activeFlag = targetUser.activeFlag || 'green';
  const flagNotes = targetUser.flagNotes || { green: '', yellow: '', red: '' };

  const handleFlagClick = async (flag: 'green' | 'yellow' | 'red') => {
    try {
      const updatedUser = { ...targetUser, activeFlag: flag };
      await updateDoc(doc(db, 'users', targetUser.uid), {
        activeFlag: flag,
        audit: arrayUnion(getAuditMetadata(profile, `Updated user flag to ${flag}`))
      });
      await logGlobalAudit(profile, 'Update Flag Status', 'profile', `Updated flag to ${flag} for ${targetUser.displayName}`, targetUser.uid, targetUser.displayName);
      onUpdate(updatedUser);
      toast.success(t('FlagUpdated'));
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditNote = (flag: 'green' | 'yellow' | 'red') => {
    setEditingFlag(flag);
    setNoteText(flagNotes[flag] || '');
  };

  const handleSaveNote = async () => {
    if (!editingFlag) return;
    try {
      const newNotes = { ...flagNotes, [editingFlag]: noteText };
      const updatedUser = { ...targetUser, flagNotes: newNotes };
      await updateDoc(doc(db, 'users', targetUser.uid), {
        flagNotes: newNotes,
        audit: arrayUnion(getAuditMetadata(profile, `Updated flag notes for ${editingFlag}`))
      });
      onUpdate(updatedUser);
      setEditingFlag(null);
      toast.success(t('NoteSaved'));
    } catch (error) {
      console.error(error);
    }
  };

  const toggleViewNote = (flag: 'green' | 'yellow' | 'red') => {
    setViewingFlag(viewingFlag === flag ? null : flag);
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Flag size={16} className="text-blue-600" />
        {t('UserStatusFlags')}
      </h3>
      <div className="flex justify-around items-start gap-4">
        {(['green', 'yellow', 'red'] as const).map((color) => {
          const isActive = activeFlag === color;
          const isFlashing = (color === 'yellow' || color === 'red') && isActive;
          
          return (
            <div key={`user-flag-${targetUser.uid}-${color}`} className="flex flex-col items-center gap-2 flex-1">
              <button
                onClick={() => handleFlagClick(color)}
                className={`
                  p-3 rounded-full transition-all relative
                  ${isActive ? 'ring-4 ring-offset-2' : 'opacity-40 hover:opacity-100'}
                  ${color === 'green' ? 'bg-emerald-500 ring-emerald-200' : ''}
                  ${color === 'yellow' ? 'bg-amber-400 ring-amber-200' : ''}
                  ${color === 'red' ? 'bg-red-500 ring-red-200' : ''}
                  ${isFlashing ? 'animate-pulse' : ''}
                `}
              >
                <Flag size={20} className="text-white" fill="currentColor" />
              </button>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditNote(color)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                  title={t('EditNote')}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => toggleViewNote(color)}
                  className={`p-1 rounded transition-colors ${viewingFlag === color ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`}
                  title={t('ViewNote')}
                >
                  <Eye size={14} />
                </button>
              </div>

              {viewingFlag === color && (
                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 w-full break-words">
                  {flagNotes[color] || t('NoNote')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {editingFlag && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Edit3 size={20} className="text-blue-600" />
                {t('EditFlagNote', { color: t(editingFlag) })}
              </h3>
              <textarea
                className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('TypeNoteHere')}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingFlag(null)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('Save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CommunicationOptions = ({ targetUser }: { targetUser: UserProfile | null }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'admin'),
        where('status', '==', 'active'),
        limit(1)
      );
      getDocs(q).then(snap => {
        if (!snap.empty) {
          setAdminProfile(snap.docs[0].data() as UserProfile);
        }
      }).catch(err => handleFirestoreError(err, OperationType.GET, 'users'));
    }
  }, [isAdmin]);

  const contactUser = isAdmin ? targetUser : adminProfile;

  if (!contactUser) return null;
  if (isAdmin && contactUser.role === 'admin') return null;

  const phoneNumber = contactUser.phoneNumber || contactUser.personalPhone || contactUser.officePhone || '';
  const email = contactUser.email || '';
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  const handleWhatsApp = () => {
    if (!cleanPhone) {
      toast.error(t('NoPhoneNumber'));
      return;
    }
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleSMS = () => {
    if (!cleanPhone) {
      toast.error(t('NoPhoneNumber'));
      return;
    }
    window.open(`sms:${cleanPhone}`, '_blank');
  };

  const handleEmail = () => {
    if (!email) {
      toast.error(t('NoEmail'));
      return;
    }
    window.open(`mailto:${email}`, '_blank');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mt-8">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('CommunicationSystem')}</h2>
        <VIPBadge userId={contactUser.uid} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-2 px-2 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-100 w-full min-h-[3.5rem]"
        >
          <MessageCircle size={20} className="shrink-0" />
          <span className="text-sm md:text-base break-words">WhatsApp</span>
        </button>
        <button
          onClick={handleSMS}
          className="flex items-center justify-center gap-2 px-2 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 w-full min-h-[3.5rem]"
        >
          <MessageSquare size={20} className="shrink-0" />
          <span className="text-sm md:text-base break-words">{t('TextMessage')}</span>
        </button>
      </div>
    </div>
  );
};

const ServiceRequest = ({ clientId }: { clientId?: string }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceDescription, setCustomServiceDescription] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [showNoPaymentLinkPrompt, setShowNoPaymentLinkPrompt] = useState(false);
  const [globalStripeLink, setGlobalStripeLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const targetClientId = clientId || user?.uid;

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(doc(db, 'global_config', 'payment'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalStripeLink(docSnap.data().stripeLink || '');
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'global_config/payment'));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'services'));
    getDocs(q).then(snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setServices(data);
    }).catch(err => console.error(err));
  }, []);

  const handleRequest = async () => {
    if (!targetClientId) return;
    
    // SAFETY CHECK: Administrators cannot order services for themselves
    if (profile?.role === 'admin' && targetClientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    
    let serviceToSave = '';
    let serviceObj: Service | undefined;

    if (showCustomInput) {
      if (!customServiceName) return;
      serviceToSave = customServiceName;
      
      // Save to user_custom_services
      await addDoc(collection(db, 'user_custom_services'), {
        clientId: targetClientId,
        name: customServiceName,
        description: customServiceDescription,
        createdAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, `Added custom service: ${customServiceName}`)
      });
    } else {
      serviceObj = services.find(s => s.id === selectedServiceId);
      if (!serviceObj) return;
      serviceToSave = `${serviceObj.name} - $${serviceObj.price}`;
    }

    if (!serviceToSave) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'appointments'), {
        clientId: targetClientId,
        date: new Date().toISOString(),
        service: serviceToSave,
        status: 'New',
        paymentStatus: 'no pay',
        notes: clientId ? 'Requested by admin' : 'Requested via portal',
        createdAt: new Date().toISOString(),
        performedBy: profile?.adminId || null,
        requestedByAdminId: profile?.adminId || null,
        audit: getAuditMetadata(profile, `Requested service: ${serviceToSave}`)
      });
      
      await logGlobalAudit(profile, 'Order Service', 'service', `Ordered ${serviceToSave} for client (ID: ${targetClientId})`, docRef.id);

      toast.success(t('ServiceRequested'));
      // Don't clear selectedServiceId yet so modals can use it
      setCustomServiceName('');
      setCustomServiceDescription('');
      setShowCustomInput(false);

      // 1. Open form if exists
      if (serviceObj?.formUrl) {
        window.open(serviceObj.formUrl, '_blank');
      }

      // 2. Handle payment prompt
      if (serviceObj?.paymentLink) {
        setShowPaymentPrompt(true); 
      } else if (!clientId) {
        setShowNoPaymentLinkPrompt(true);
      }
    } catch (error) {
      toast.error(t('FailedRequest'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!showCustomInput ? (
        <div className="space-y-4">
          <div className="flex justify-end mb-1">
            <span className="text-blue-900 font-bold text-xs">
              {services.length} {t('ServicesAvailable', 'Services available')}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-bold placeholder:text-slate-600"
              placeholder="Search any service with keywords"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>

          <div className="flex justify-start">
            <button 
              onClick={() => setShowCustomInput(true)}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {t('AddCustomService', '+ Add custom service')}
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {services
              .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
              .map(s => (
                <div
                  key={`expert-service-opt-${s.id}`}
                  onClick={() => setSelectedServiceId(s.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                    selectedServiceId === s.id 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                    <div className="text-xs text-slate-500">{!s.price || s.price === 0 ? 'Fee is to be determined.' : '$' + s.price}</div>
                  </div>
                  {selectedServiceId === s.id && (
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              ))}
            {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500 italic">
                {t('NoServicesFound')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter custom service name..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium"
              value={customServiceName}
              onChange={(e) => setCustomServiceName(e.target.value)}
              autoFocus
            />
            <button 
              onClick={() => {
                setShowCustomInput(false);
                setCustomServiceName('');
                setCustomServiceDescription('');
              }}
              className="px-3 py-2 text-slate-500 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>
          <textarea
            placeholder="Enter service description..."
            className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] resize-none"
            value={customServiceDescription}
            onChange={(e) => setCustomServiceDescription(e.target.value)}
          />
          <p className="text-[10px] text-slate-400 italic">This service will be saved to your custom services and used for this request.</p>
        </div>
      )}
      <button 
        onClick={() => handleRequest()}
        disabled={isSubmitting || (showCustomInput ? !customServiceName : !selectedServiceId)}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? t('Processing') : t('RequestAnyService', 'Request any Service')}
      </button>

      {showPaymentPrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {t('Payment')} - {services.find(s => s.id === selectedServiceId)?.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentPrompt(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-50 relative">
              <iframe 
                src={services.find(s => s.id === selectedServiceId)?.paymentLink} 
                className="w-full h-full border-none"
                title={t('Payment')}
              />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-500 italic">
                {t('PaymentSecureNote', 'Secure payment processing via Stripe')}
              </p>
              <div className="flex gap-3">
                <a
                  href={services.find(s => s.id === selectedServiceId)?.paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  {t('OpenInNewTab')}
                </a>
                <button
                  onClick={() => {
                    setShowPaymentPrompt(false);
                    setSelectedServiceId('');
                  }}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all"
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showNoPaymentLinkPrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg p-8 rounded-2xl shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard size={32} />
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-8 text-lg leading-relaxed text-justify">
              {t('ServiceRequestedNoPaymentLink')}
            </p>
            <div className="flex flex-col gap-4">
              {globalStripeLink && (
                <a 
                  href={globalStripeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-lg"
                >
                  <ExternalLink size={22} />
                  {t('Pay Here') || 'Pay Here'}
                </a>
              )}
              <button
                onClick={() => {
                  setShowNoPaymentLinkPrompt(false);
                  setSelectedServiceId('');
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {t('Close') || 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const RequestServiceBlock = ({ clientId }: { clientId?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-blue-500 transition-colors duration-300">
      <div className="flex flex-wrap justify-center gap-6 mb-7 mt-2">
        <span className="px-9 py-3 bg-blue-600 text-white rounded-xl font-bold text-xl shadow-md whitespace-nowrap">
          {t('IndividualServices') || 'Personal Services'}
        </span>
        <span className="px-9 py-3 bg-blue-600 text-white rounded-xl font-bold text-xl shadow-md whitespace-nowrap">
          {t('BusinessServices') || 'Business Services'}
        </span>
        <span className="px-9 py-3 bg-blue-600 text-white rounded-xl font-bold text-xl shadow-md whitespace-nowrap">
          {t('MasterClassesWorkshop') || 'Masterclasses/Coaching'}
        </span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center mt-6">
        {t('RequestAnyService')}
      </h2>
      <ServiceRequest clientId={clientId} />
    </div>
  );
};

const ReferralTrackingList = ({ userId }: { userId: string }) => {
  const { t } = useTranslation();
  const { profile, isAdmin } = useAuth();
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [referredUserPayments, setReferredUserPayments] = useState<Record<string, boolean>>({});
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [targetReferralUid, setTargetReferralUid] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        setTargetUser(docSnap.data() as UserProfile);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users'), where('referrerId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setReferredUsers(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return unsubscribe;
  }, [userId]);

  const filteredReferredUsers = referredUsers.filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.clientId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (referredUsers.length === 0) return;
    
    const uids = referredUsers.map(u => u.uid);
    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) {
      chunks.push(uids.slice(i, i + 10));
    }

    const unsubscribes = chunks.map(chunk => {
      const q = query(collection(db, 'appointments'), where('clientId', 'in', chunk));
      return onSnapshot(q, (snapshot) => {
        const paymentMap: Record<string, boolean> = {};
        snapshot.docs.forEach(doc => {
          const app = doc.data() as Appointment;
          if (app.paymentStatus === 'PaPay' || app.paymentStatus === 'FullPay') {
            paymentMap[app.clientId] = true;
          }
        });
        setReferredUserPayments(prev => ({ ...prev, ...paymentMap }));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [referredUsers]);

  const handleMarkReferralPaid = async () => {
    if (!targetReferralUid || !paidAmount || !paymentMethod) return;
    
    try {
      await updateDoc(doc(db, 'users', targetReferralUid), {
        referralCreditPaid: true,
        referralCreditPaidAt: new Date().toISOString(),
        referralCreditPaidBy: profile?.adminId || null,
        referralCreditAmount: paidAmount,
        referralCreditPaymentMethod: paymentMethod,
        audit: getAuditMetadata(profile, `Marked referral credit as paid: ${paidAmount}`)
      });
      toast.success(t('ReferralCreditMarkedAsPaid') || 'Referral credit marked as paid');
      setShowPaidModal(false);
      setTargetReferralUid(null);
      setPaidAmount('');
      setPaymentMethod('');
    } catch (error) {
      toast.error(t('FailedToUpdateReferralCredit') || 'Failed to update referral credit');
    }
  };

  if (!isAdmin && profile?.uid !== userId) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mt-8">
      <div className="flex items-center gap-2 mb-6">
        <Users className="text-blue-600" size={20} />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('ReferralTrackingList')}</h2>
        {targetUser?.referralCode && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Code: {targetUser.referralCode}
            </span>
            <VIPBadge userId={userId} />
            {isAdmin && (
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'users', userId), {
                      isManualVIP: !targetUser.isManualVIP,
                      audit: getAuditMetadata(profile, `${!targetUser.isManualVIP ? 'Marked' : 'Removed'} user as VIP`)
                    });
                    toast.success(targetUser.isManualVIP ? t('VIPRemoved') || 'VIP status removed' : t('VIPMarked') || 'User marked as VIP');
                  } catch (error) {
                    toast.error(t('FailedToUpdateVIP') || 'Failed to update VIP status');
                  }
                }}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  targetUser.isManualVIP 
                    ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' 
                    : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                }`}
              >
                {targetUser.isManualVIP ? t('RemoveVIP') : t('MarkAsVIP')}
              </button>
            )}
          </div>
        )}
        <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
          {referredUsers.length} {t('Referred')}
        </span>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder={t('SearchReferredUsers') || "Search by name, email or ID..."}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : referredUsers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Users className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500 font-medium">{t('NoReferredUsersFound') || 'No referred users found'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('RefereeFullName')}</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('RefereeEmail')}</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('RefereePhone')}</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('ReferralCredit')}</th>
                <th className="pb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('ProfileCreationDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReferredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Search className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500 font-medium">{t('NoResultsFound') || 'No results found'}</p>
                  </td>
                </tr>
              ) : (
                filteredReferredUsers.map((u) => {
                  const hasPaid = referredUserPayments[u.uid];
                  return (
                    <tr 
                      key={`referral-user-${u.uid}`} 
                      className={`hover:bg-slate-50 transition-colors ${isAdmin ? 'cursor-pointer group' : ''}`}
                      onClick={() => isAdmin && navigate(`/admin/users/${u.uid}`)}
                    >
                      <td className={`py-4 text-sm font-medium text-slate-900 ${isAdmin ? 'group-hover:text-blue-600' : ''}`}>{u.displayName}</td>
                      <td className="py-4 text-sm text-slate-600">{u.email}</td>
                      <td className="py-4 text-sm text-slate-600">{u.phoneNumber || '-'}</td>
                      <td className="py-4 text-sm">
                        {u.referralCreditPaid ? (
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase w-fit">
                              {t('Paid')}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {u.referralCreditAmount} via {u.referralCreditPaymentMethod}
                            </span>
                          </div>
                        ) : (
                          isAdmin ? (
                            <button 
                              disabled={!hasPaid}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetReferralUid(u.uid);
                                setShowPaidModal(true);
                              }}
                              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                                hasPaid 
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                              title={!hasPaid ? t('NoPaymentsMadeByReferral') || 'No payments made by referral' : ''}
                            >
                              {t('MarkAsPaid')}
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase">
                              {t('Unpaid')}
                            </span>
                          )
                        )}
                      </td>
                      <td className="py-4 text-sm text-slate-600">
                        {safeFormat(u.createdAt, 'PP')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showPaidModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">{t('MarkReferralAsPaid')}</h3>
                <button onClick={() => setShowPaidModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                  <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                  <p className="text-sm text-amber-800 font-medium">
                    {t('CredibleReferralWarning') || 'Are you sure the referral has successfully passed the credible referral test?'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('AmountPaid')}</label>
                  <input 
                    type="text"
                    placeholder="$0.00"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('PaymentMethod')}</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="">{t('SelectMethod')}</option>
                    <option value="Cash">{t('Cash')}</option>
                    <option value="Bank Transfer">{t('BankTransfer')}</option>
                    <option value="Check">{t('Check')}</option>
                    <option value="Zelle">{t('Zelle')}</option>
                    <option value="Stripe">{t('Stripe')}</option>
                  </select>
                </div>

                <button 
                  onClick={handleMarkReferralPaid}
                  disabled={!paidAmount || !paymentMethod}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('ConfirmPayment')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin, profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [individualSearch, setIndividualSearch] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [randomSeed, setRandomSeed] = useState(Date.now());
  const personalRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);
  const workshopRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setRandomSeed(Date.now());
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'admin'),
        where('status', '==', 'active'),
        limit(1)
      );
      getDocs(q).then(snap => {
        if (!snap.empty) {
          setAdminProfile(snap.docs[0].data() as UserProfile);
        }
      }).catch(err => handleFirestoreError(err, OperationType.GET, 'users'));
    }
  }, [isAdmin]);

  const contactUser = isAdmin ? null : adminProfile;
  const phoneNumber = contactUser?.phoneNumber || contactUser?.personalPhone || contactUser?.officePhone || '';
  const email = contactUser?.email || '';
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  const handleWhatsApp = () => {
    if (!cleanPhone) {
      toast.error(t('NoPhoneNumber'));
      return;
    }
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleSMS = () => {
    if (!cleanPhone) {
      toast.error(t('NoPhoneNumber'));
      return;
    }
    window.open(`sms:${cleanPhone}`, '_blank');
  };

  const handleEmail = () => {
    if (!email) {
      toast.error(t('NoEmail'));
      return;
    }
    window.open(`mailto:${email}`, '_blank');
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'services');
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  const filteredIndividualServices = services
    .filter(s => 
      (s.type === 'individual' || !s.type) && 
      (s.name.toLowerCase().includes(individualSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(individualSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredBusinessServices = services
    .filter(s => 
      s.type === 'business' && 
      (s.name.toLowerCase().includes(businessSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(businessSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredWorkshopServices = services
    .filter(s => 
      s.type === 'workshop' && 
      (s.name.toLowerCase().includes(workshopSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(workshopSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const ServiceGrid = ({ services, searchTerm, setSearchTerm, title }: { services: Service[], searchTerm: string, setSearchTerm: (v: string) => void, title: string }) => {
    const displayedServices = useMemo(() => {
      if (searchTerm || services.length <= 3) return services;
      
      const shuffled = [...services].sort((a, b) => {
        const seedA = (randomSeed + a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 1000;
        const seedB = (randomSeed + b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 1000;
        return seedA - seedB;
      });
      return shuffled;
    }, [services, searchTerm, randomSeed]);

    return (
      <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-3 md:space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent mt-4">
        {displayedServices.length > 0 ? (
          <div className="flex flex-col gap-3 md:gap-4">
            {displayedServices.map(service => (
              <ServiceDisplayCard key={`landing-service-${service.id}`} service={service} className="!shadow-none border-slate-200/60">
                <button 
                  onClick={() => navigate('/portal/appointments')}
                  className="w-full mt-auto py-1.5 md:py-2 bg-slate-900 text-white rounded-lg font-bold text-[10px] md:text-xs hover:bg-blue-600 transition-all"
                >
                  {t('RequestAnyService', 'Request any Service')}
                </button>
              </ServiceDisplayCard>
            ))}
          </div>
        ) : (
          <div className="py-6 md:py-12 text-center bg-slate-50 rounded-xl md:rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 italic text-[10px] md:text-sm">{t('NoServicesFound')}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 md:space-y-16 pb-20">
      <section className="relative h-[400px] md:h-[600px] rounded-3xl md:rounded-[40px] overflow-hidden shadow-2xl mx-2 md:mx-4">
        <img 
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920" 
          alt="Hero" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex flex-col justify-end items-center text-center p-4 md:p-12 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl w-full"
          >
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-3 px-6 py-3 bg-blue-600 rounded-full text-base md:text-lg font-black text-white shadow-lg shadow-blue-200">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                {services.length} Services Available
              </div>
            </div>
            <h1 className="text-3xl md:text-6xl font-black text-white mb-4 md:mb-6 leading-tight md:leading-[1.1] tracking-tight">{t('HomeTitle')}</h1>
            <div className="flex flex-wrap gap-2 md:gap-3 justify-center items-center">
              <button 
                onClick={() => window.location.href = 'tel:+18009196882'}
                className="p-2.5 md:p-3 bg-green-500 text-white rounded-xl md:rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-100 flex items-center gap-1.5 md:gap-2"
                title="Call Us"
              >
                <Phone size={18} className="md:w-5 md:h-5" />
                <span className="text-xs md:text-base">+1 800 919 6882</span>
              </button>
              <button 
                onClick={() => navigate('/portal/calendar')}
                className="px-4 md:px-6 py-2.5 md:py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 text-xs md:text-base"
              >
                Book an Appointment
              </button>
              {contactUser && (
                <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
                  <button
                    onClick={handleWhatsApp}
                    className="p-2.5 md:p-3 bg-green-500 text-white rounded-xl md:rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-100 flex items-center gap-1.5 md:gap-2"
                    title="WhatsApp"
                  >
                    <MessageCircle size={18} className="md:w-5 md:h-5" />
                    <span className="hidden sm:inline text-xs md:text-sm">WhatsApp</span>
                  </button>
                  <button
                    onClick={handleSMS}
                    className="p-2.5 md:p-3 bg-blue-500 text-white rounded-xl md:rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 flex items-center gap-1.5 md:gap-2"
                    title={t('TextMessage')}
                  >
                    <MessageSquare size={18} className="md:w-5 md:h-5" />
                    <span className="hidden sm:inline text-xs md:text-sm">{t('TextMessage')}</span>
                  </button>
                  <button
                    onClick={handleEmail}
                    className="p-2.5 md:p-3 bg-green-600 text-white rounded-xl md:rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-1.5 md:gap-2"
                    title={t('EmailApp')}
                  >
                    <Mail size={18} className="md:w-5 md:h-5" />
                    <span className="hidden sm:inline text-xs md:text-sm">{t('EmailApp')}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="our-services" className="px-4">
        <div className="max-w-7xl mx-auto">
          <RequestServiceBlock />
        </div>
      </section>

      {/* Communication and Portal info removed from here */}
    </div>
  );
};

const DailyServiceReport = ({ appointments, users, offices, services }: { appointments: Appointment[], users: UserProfile[], offices: Office[], services: Service[] }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [officeSearch, setOfficeSearch] = useState('');
  const [dateSearch, setDateSearch] = useState(format(new Date(), 'yyyy-MM-dd'));

  const logAccess = async () => {
    try {
      await addDoc(collection(db, 'restrictedAreaAudit'), {
        userId: profile?.uid,
        userName: profile?.displayName,
        userEmail: profile?.email,
        action: 'ACCESS_RESTRICTED_REPORT',
        timestamp: new Date().toISOString(),
        details: 'Accessed Daily Service Requests and Fees Report'
      });
    } catch (error) {
      console.error('Failed to log access:', error);
    }
  };

  const handleUnlock = () => {
    if (warningCount < 2) {
      toast.warning(t('RestrictedAreaWarning') || 'a restricted area, do not enter');
      setWarningCount(prev => prev + 1);
    } else {
      setIsUnlocked(true);
      logAccess();
    }
  };

  const reportData = useMemo(() => {
    if (!isUnlocked) return [];

    const filteredApps = appointments.filter(app => {
      const appDate = safeFormat(app.createdAt, 'yyyy-MM-dd');
      const matchesDate = appDate === dateSearch;
      
      const admin = users.find(u => u.uid === app.assignedAdminId);
      const office = offices.find(o => o.id === admin?.officeId);
      const matchesOffice = !officeSearch || office?.nickName.toLowerCase().includes(officeSearch.toLowerCase());

      return matchesDate && matchesOffice;
    });

    const officeStats: Record<string, { officeName: string, services: string[], totalFee: number }> = {};

    filteredApps.forEach(app => {
      const admin = users.find(u => u.uid === app.assignedAdminId);
      const office = offices.find(o => o.id === admin?.officeId);
      const officeId = office?.id || 'unknown';
      const officeName = office?.nickName || 'Unknown Office';

      if (!officeStats[officeId]) {
        officeStats[officeId] = { officeName, services: [], totalFee: 0 };
      }

      officeStats[officeId].services.push(app.service);
      
      const service = services.find(s => s.name === app.service);
      if (service) {
        officeStats[officeId].totalFee += service.price;
      }
    });

    return Object.values(officeStats);
  }, [appointments, users, offices, services, isUnlocked, officeSearch, dateSearch]);

  if (!isUnlocked) {
    return (
      <div 
        onClick={handleUnlock}
        className="bg-slate-900 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer border-4 border-red-600 border-dashed group hover:bg-slate-800 transition-colors"
      >
        <ShieldAlert size={64} className="text-red-600 mb-4 group-hover:scale-110 transition-transform" />
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">{t('DailyServiceRequestsReport')}</h2>
        <p className="text-red-500 font-bold mt-2 animate-pulse">{t('RestrictedAreaWarning')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            {t('DailyServiceRequestsReport')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('AuditLog')}: {t('AccessLogged') || 'Access is being logged for security'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('SearchByOffice')}
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={officeSearch}
              onChange={(e) => setOfficeSearch(e.target.value)}
            />
          </div>
          <div className="relative flex-1 md:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={dateSearch}
              onChange={(e) => setDateSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-bold">{t('Office')}</th>
              <th className="px-6 py-4 font-bold">{t('RequestedServices')}</th>
              <th className="px-6 py-4 font-bold text-right">{t('TotalFeeReceived')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {reportData.map((data, idx) => (
              <tr key={`report-office-${data.officeName}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{data.officeName}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {data.services.map((s, i) => (
                      <span key={`report-service-${data.officeName}-${idx}-${i}`} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] rounded-full border border-blue-100 dark:border-blue-800">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-green-600 dark:text-green-400">
                  ${data.totalFee.toLocaleString()}
                </td>
              </tr>
            ))}
            {reportData.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500 italic">
                  {t('NoDataFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SupervisionAdmins = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoteSearch, setPromoteSearch] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [actionWarning, setActionWarning] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({ show: false, title: '', message: '', action: async () => {} });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Filter out paused administrators and potentially deleted ones (though deleted are usually moved to another collection)
      setAdmins(data.filter(a => a.status !== 'paused'));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const supervisors = admins.filter(a => a.isSupervisor);

  const filteredPromoteAdmins = admins.filter(a => 
    (a.displayName || '').toLowerCase().includes(promoteSearch.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(promoteSearch.toLowerCase())
  );

  const filteredAssignAdmins = admins.filter(a => !a.isSupervisor).filter(a => 
    (a.displayName || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(assignSearch.toLowerCase())
  );

  const toggleSupervisor = async (admin: UserProfile) => {
    const isPromoting = !admin.isSupervisor;
    setActionWarning({
      show: true,
      title: isPromoting ? t('ConfirmPromotion') : t('ConfirmDemotion'),
      message: isPromoting 
        ? t('PromoteWarningEffect', 'This will promote the administrator to a Supervisor role, allowing them to oversee other administrators.')
        : t('DemoteWarningEffect', 'This will remove the Supervisor role from this administrator. Any existing superoxide assignments will remain but they will lose management access.'),
      action: async () => {
        try {
          await updateDoc(doc(db, 'users', admin.uid), {
            isSupervisor: !admin.isSupervisor,
            supervisorId: null,
            audit: arrayUnion({
              adminId: profile?.uid || 'system',
              adminName: profile?.displayName || 'System',
              timestamp: new Date().toISOString(),
              action: admin.isSupervisor ? 'Removed Supervisor Role' : 'Promoted to Supervisor'
            })
          });
          await logGlobalAudit(profile, admin.isSupervisor ? 'Demote Supervisor' : 'Promote Supervisor', 'system', `${admin.isSupervisor ? 'Demoted' : 'Promoted'} ${admin.displayName} ${admin.isSupervisor ? 'from' : 'to'} Supervisor role`, admin.uid, admin.displayName);
          toast.success(admin.isSupervisor ? t('SupervisorDemoted', 'Supervisor status removed') : t('SupervisorPromoted', 'Administrator promoted to Supervisor'));
        } catch (error) {
          toast.error(t('UpdateFailed'));
        }
      }
    });
  };

  const assignSupervisor = async (adminId: string, supervisorId: string) => {
    const supervisor = admins.find(s => s.uid === supervisorId);
    setActionWarning({
      show: true,
      title: t('ConfirmAssignment'),
      message: supervisorId 
        ? t('AssignWarningEffect', `This will place this administrator under the supervision of ${supervisor?.displayName || 'the selected supervisor'}.`)
        : t('RemoveAssignWarningEffect', 'This will remove the current supervisor assignment for this administrator.'),
      action: async () => {
        try {
          await updateDoc(doc(db, 'users', adminId), {
            supervisorId: supervisorId || null,
            audit: arrayUnion({
              adminId: profile?.uid || 'system',
              adminName: profile?.displayName || 'System',
              timestamp: new Date().toISOString(),
              action: supervisorId ? `Assigned supervisor: ${supervisor?.displayName || supervisorId}` : 'Removed supervisor'
            })
          });
          await logGlobalAudit(profile, supervisorId ? 'Assign Supervisor' : 'Remove Supervisor Assignment', 'system', `${supervisorId ? `Assigned ${supervisor?.displayName} as supervisor for` : 'Removed supervisor assignment for'} ${admins.find(a => a.uid === adminId)?.displayName || 'admin'}`, adminId);
          toast.success(t('SupervisionAssigned', 'Supervision assigned successfully'));
        } catch (error) {
          toast.error(t('UpdateFailed'));
        }
      }
    });
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('SupervisionManagement')}</h1>
          <p className="text-slate-500">{t('SupervisionManagementDesc', 'Manage administrators and their supervisors.')}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <AuditInfo audit={admins.flatMap(a => normalizeAudit(a.audit)).filter(e => (e.action || '').includes('Supervisor') || (e.action || '').includes('supervisor'))} />
          )}
          <button 
            onClick={() => navigate('/admin/offices-and-admins')}
            className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all font-bold shadow-sm"
          >
            <ArrowLeft size={20} />
            <span>{t('Back')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Column 1: Promote to Supervisor */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {t('PromoteToSupervisor')}
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder={t('SearchAdmins')}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={promoteSearch}
                onChange={(e) => setPromoteSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredPromoteAdmins.map(admin => (
              <div key={`report-promote-admin-${admin.uid}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold">
                    {(admin.displayName || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {admin.displayName}
                      {admin.isSupervisor && (
                        <Crown size={14} className="text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{admin.email}</div>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSupervisor(admin)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    admin.isSupervisor 
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-sm' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
                  }`}
                >
                  {admin.isSupervisor ? t('RemoveSupervisor', 'Remove Supervisor') : t('Promote')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Assign to Supervisor */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Users size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {t('Admin & Supervisor')}
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder={t('SearchAdmins')}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredAssignAdmins.map(admin => (
              <div key={`report-assign-admin-${admin.uid}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 group hover:border-emerald-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs">
                      {(admin.displayName || '?').charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{admin.displayName}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {t('CurrentSupervisor')}: <span className="text-emerald-600">{admins.find(s => s.uid === admin.supervisorId)?.displayName || t('None')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 appearance-none font-medium"
                    value={admin.supervisorId || ''}
                    onChange={(e) => assignSupervisor(admin.uid, e.target.value)}
                  >
                    <option value="">{t('SelectSupervisor')}</option>
                    {supervisors.map(s => (
                      <option key={`assign-supervisor-option-${s.uid}`} value={s.uid}>{s.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            ))}
            {filteredAssignAdmins.length === 0 && (
              <div className="p-12 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Activity size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-400 italic text-sm">{t('NoAdministratorsFound')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {actionWarning.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-900/50 overflow-hidden"
          >
            <div className="p-8">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <ShieldAlert className="text-blue-600" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-4">{actionWarning.title}</h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-4 rounded-xl mb-8">
                <p className="text-center text-blue-800 dark:text-blue-200 font-medium leading-relaxed italic">
                  {actionWarning.message}
                </p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    await actionWarning.action();
                    setActionWarning({ ...actionWarning, show: false });
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {t('Proceed')}
                </button>
                <button 
                  onClick={() => setActionWarning({ ...actionWarning, show: false })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  {t('GoBack')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const OfficesAndAdmins = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, canEdit, isAdmin } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'profile'>('list');
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [viewingAdmin, setViewingAdmin] = useState<UserProfile | null>(null);
  const [isEditingAdminProfile, setIsEditingAdminProfile] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ displayName: '', adminId: '' });
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignSearchQuery, setReassignSearchQuery] = useState('');
  const [revokeAdmin, setRevokeAdmin] = useState<UserProfile | null>(null);
  const [revokeStep, setRevokeStep] = useState(0);
  const [promoteSearchQuery, setPromoteSearchQuery] = useState('');

  const [deletedAdmins, setDeletedAdmins] = useState<UserProfile[]>([]);
  const [deletedAdminsSearchQuery, setDeletedAdminsSearchQuery] = useState('');
  const [isDeletingPermanently, setIsDeletingPermanently] = useState<UserProfile | null>(null);

  const [viewingSupervisedAdmin, setViewingSupervisedAdmin] = useState<UserProfile | null>(null);
  const [superviseeSearchQuery, setSuperviseeSearchQuery] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, 'appointments'), (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, 'deleted_admins'), (snap) => {
      setDeletedAdmins(snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserProfile));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'deleted_admins'));
    return unsub;
  }, [isAdmin]);

  const RevokeAdminModal = () => {
    if (!revokeAdmin) return null;

    const steps = [
      {
        title: t('RevokeAdminWarningTitle1'),
        message: t('RevokeAdminWarningMessage1'),
        confirmText: t('Next'),
        icon: <AlertTriangle className="text-yellow-600" size={32} />
      },
      {
        title: t('RevokeAdminWarningTitle2'),
        message: t('RevokeAdminWarningMessage2'),
        confirmText: t('ConfirmRevocation'),
        icon: <AlertTriangle className="text-yellow-600" size={32} />
      }
    ];

    const currentStep = steps[revokeStep];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-yellow-200 dark:border-yellow-900/50 overflow-hidden"
        >
          <div className="p-8">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              {currentStep.icon}
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-4">{currentStep.title}</h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-xl mb-8">
              <p className="text-center text-yellow-800 dark:text-yellow-200 font-medium leading-relaxed">
                {currentStep.message}
              </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  if (revokeStep < steps.length - 1) {
                    setRevokeStep(revokeStep + 1);
                  } else {
                    handleRemoveAdmin(revokeAdmin.uid, revokeAdmin.email);
                    setRevokeAdmin(null);
                    setRevokeStep(0);
                  }
                }}
                className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-yellow-200 dark:shadow-none"
              >
                {currentStep.confirmText}
              </button>
              <button 
                onClick={() => {
                  setRevokeAdmin(null);
                  setRevokeStep(0);
                }}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {t('CancelNow')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    try {
      await updateDoc(doc(db, 'users', editingAdmin.uid), {
        displayName: adminEditForm.displayName,
        adminId: adminEditForm.adminId,
        updatedAt: new Date().toISOString()
      });
      toast.success(t('AdminUpdated'));
      setEditingAdmin(null);
    } catch (error) {
      console.error(error);
    }
  };

  const [officeForm, setOfficeForm] = useState({
    nickName: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    zipCode: '',
    mainPhone: '',
    managerName: '',
    managerPhone: ''
  });

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribeOffices = onSnapshot(collection(db, 'offices'), (snapshot) => {
      setOffices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Office)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'offices'));

    const unsubscribeAdmins = onSnapshot(query(collection(db, 'users'), where('role', '==', 'admin')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setAdmins(data.filter(a => a.status !== 'paused'));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubscribeOffices();
      unsubscribeAdmins();
      unsubscribeUsers();
    };
  }, [isAdmin]);

  useEffect(() => {
    const migrateOffices = async () => {
      const officesToMigrate = offices.filter(o => !o.officeCode || o.officeCode.startsWith('O0'));
      if (officesToMigrate.length === 0) return;

      let currentMax = 999; // Start from 1000
      offices.forEach(o => {
        if (o.officeCode && !o.officeCode.startsWith('O')) {
          const num = parseInt(o.officeCode);
          if (!isNaN(num) && num > currentMax) currentMax = num;
        }
      });

      for (const office of officesToMigrate) {
        currentMax++;
        const newCode = currentMax.toString();
        try {
          await updateDoc(doc(db, 'offices', office.id), { officeCode: newCode });
        } catch (error) {
          console.error(`Failed to migrate office ${office.id}:`, error);
        }
      }
    };

    if (offices.length > 0 && !loading) {
      migrateOffices();
    }
  }, [offices, loading]);

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentCodes = offices.map(o => {
        if (o.officeCode && o.officeCode.startsWith('O') && !o.officeCode.startsWith('O0')) {
          return parseInt(o.officeCode.substring(1));
        }
        return 0;
      }).filter(id => !isNaN(id));
      
      const nextId = Math.max(999, ...currentCodes) + 1;
      const formattedCode = `O${nextId.toString()}`;

      await addDoc(collection(db, 'offices'), {
        ...officeForm,
        officeCode: formattedCode,
        status: 'active',
        createdAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, `Created new office: ${officeForm.nickName}`)
      });
      toast.success(t('OfficeAdded'));
      setView('list');
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffice) return;
    try {
      await updateDoc(doc(db, 'offices', selectedOffice.id), {
        ...officeForm,
        updatedAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, `Updated office details for: ${officeForm.nickName}`)
      });
      toast.success(t('OfficeUpdated'));
      setView('list');
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteOffice = async (id: string) => {
    if (window.confirm(t('DeleteOfficeConfirmation') || 'Are you sure you want to delete this office?')) {
      try {
        await deleteDoc(doc(db, 'offices', id));
        toast.success(t('OfficeDeleted'));
        if (selectedOffice?.id === id) setView('list');
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleToggleOfficeStatus = async (office: Office) => {
    const newStatus = office.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'offices', office.id), { 
        status: newStatus,
        audit: getAuditMetadata(profile, `Changed office status of ${office.nickName} to ${newStatus}`)
      });
      toast.success(t('OfficeStatusChanged', { status: t(newStatus === 'active' ? 'Active' : 'Paused') }));
    } catch (error) {
      console.error(error);
    }
  };

  const handlePromoteAdmin = async () => {
    if (!selectedUserId || !selectedOffice) return;
    const userToPromote = allUsers.find(u => u.uid === selectedUserId);
    if (!userToPromote) return;

    const currentAdminIds = admins.map(a => parseInt(a.adminId || '0')).filter(id => !isNaN(id));
    const nextId = Math.max(0, ...currentAdminIds) + 1;
    const formattedId = nextId.toString().padStart(3, '0');

    try {
      const newAssignment: OfficeAssignment = {
        officeId: selectedOffice.id,
        officeCode: selectedOffice.officeCode || '',
        status: 'active',
        assignedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', selectedUserId), {
        role: 'admin',
        adminId: formattedId,
        officeId: selectedOffice.id,
        officeIdNumber: selectedOffice.officeCode?.replace('O', '') || '',
        officeAssignments: [newAssignment],
        promotedByAdminId: profile?.adminId || null,
        promotedAt: new Date().toISOString(),
        calendarUrl: '',
        languages: '',
        jobTitle: '',
        topSpecialties: '',
        credentials: '',
        yearsOfExperience: '',
        audit: arrayUnion(getAuditMetadata(profile, `Promoted user ${userToPromote.displayName} to administrator`))
      });
      setIsPromoting(false);
      setSelectedUserId('');
      toast.success(t('SecondaryAdminAdded', { id: formattedId }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveAdmin = async (uid: string, email: string) => {
    try {
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data() as UserProfile;
        // Move to deleted_admins (Revoked Administrators)
        await setDoc(doc(db, 'deleted_admins', uid), {
          ...adminData,
          revokedAt: new Date().toISOString(),
          revokedBy: profile?.uid,
          audit: getAuditMetadata(profile, `Revoked administrator access for: ${adminData.displayName}`)
        });
        await logGlobalAudit(profile, 'Revoke Admin Access', 'profile', `Revoked administrator access for ${adminData.displayName}`, uid, adminData.displayName);
        // Remove from users to fully refuse access
        await deleteDoc(doc(db, 'users', uid));
        toast.success(t('AdminRevokedPermanently'));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleDeleteAdminPermanently = async (admin: UserProfile) => {
    // This function is now merged into handleRemoveAdmin as per requirements
    handleRemoveAdmin(admin.uid, admin.email);
  };

  const handleToggleAdminStatus = async (uid: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const adminName = admins.find(a => a.uid === uid)?.displayName || uid;
      await updateDoc(doc(db, 'users', uid), { 
        status: newStatus,
        audit: arrayUnion(getAuditMetadata(profile, `Changed administrator status of ${adminName} to ${newStatus}`))
      });
      await logGlobalAudit(profile, newStatus === 'paused' ? 'Pause Admin' : 'Unpause Admin', 'profile', `${newStatus === 'paused' ? 'Paused' : 'Unpaused'} admin account for ${adminName}`, uid, adminName);
      toast.success(t('AdminStatusChanged', { status: newStatus === 'active' ? t('unpaused') : t('paused') }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleRestoreAdmin = async (admin: UserProfile) => {
    try {
      // Move back to users collection
      await setDoc(doc(db, 'users', admin.uid), {
        ...admin,
        status: 'active',
        updatedAt: new Date().toISOString(),
        audit: arrayUnion(getAuditMetadata(profile, 'Restored administrator access'))
      });
      // Remove from deleted_admins
      await deleteDoc(doc(db, 'deleted_admins', admin.uid));
      toast.success(t('AdminRestoredSuccessfully'));
    } catch (error) {
      console.error(error);
    }
  };

  const handleReassignAdmin = async (uid: string) => {
    if (!selectedOffice) return;
    try {
      const admin = admins.find(a => a.uid === uid);
      const currentAssignments = admin?.officeAssignments || [];
      const updatedAssignments = currentAssignments.map(a => ({ ...a, status: 'inactive' as const }));

      const newAssignment: OfficeAssignment = {
        officeId: selectedOffice.id,
        officeCode: selectedOffice.officeCode || '',
        status: 'active',
        assignedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', uid), {
        officeId: selectedOffice.id,
        officeIdNumber: selectedOffice.officeCode?.replace('O', '') || '',
        officeAssignments: [...updatedAssignments, newAssignment],
        updatedAt: new Date().toISOString(),
        audit: arrayUnion(getAuditMetadata(profile, `Reassigned administrator ${admin?.displayName || uid} to office: ${selectedOffice.nickName}`))
      });
      setIsReassigning(false);
      setReassignSearchQuery('');
      toast.success(t('AdminReassignedSuccessfully'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const resetForm = () => {
    setOfficeForm({
      nickName: '',
      streetAddress: '',
      city: '',
      stateProvince: '',
      zipCode: '',
      mainPhone: '',
      managerName: '',
      managerPhone: ''
    });
    setSelectedOffice(null);
  };

  const filteredOffices = offices.filter(o => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (o.nickName || '').toLowerCase().includes(q) ||
      (o.streetAddress || '').toLowerCase().includes(q) ||
      (o.city || '').toLowerCase().includes(q) ||
      (o.stateProvince || '').toLowerCase().includes(q) ||
      (o.zipCode || '').toLowerCase().includes(q) ||
      (o.mainPhone || '').toLowerCase().includes(q) ||
      (o.managerName || '').toLowerCase().includes(q) ||
      (o.managerPhone || '').toLowerCase().includes(q) ||
      (o.officeCode && o.officeCode.toLowerCase().includes(q))
    );
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('OfficesAndAdmins')}</h1>
          <p className="text-slate-500">{t('OfficesAndAdminsDesc')}</p>
        </div>
        {view === 'list' && canEdit && (
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/admin/supervision-admins')}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
            >
              <ShieldCheck size={20} />
              <span>{t('SupervisionAdmins')}</span>
            </button>
            <button 
              onClick={() => { resetForm(); setView('create'); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              <span>{t('CreateOffice')}</span>
            </button>
          </div>
        )}
        {view !== 'list' && (
          <button 
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{t('Back')}</span>
          </button>
        )}
      </div>

      {view === 'list' && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" size={20} />
            <input 
              type="text"
              placeholder={t('SearchOffices')}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffices.map(office => (
              <motion.div 
                key={`office-management-card-${office.id}`}
                layoutId={office.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => { setSelectedOffice(office); setView('profile'); }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <HomeIcon size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    office.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t(office.status === 'active' ? 'Active' : 'Paused')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{office.nickName}</h3>
                  {office.officeCode && (
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                      {office.officeCode}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                  <MapPin size={14} /> {office.city}, {office.stateProvince}
                </p>
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="text-xs text-slate-400">
                    {t('Manager')}: <span className="text-slate-600 font-medium">{office.managerName}</span>
                    <div className="mt-1">
                      <AuditInfo audit={office.audit} />
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </motion.div>
            ))}
            {filteredOffices.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400">{t('NoOfficesFound')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {(view === 'create' || view === 'edit') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-6">{view === 'create' ? t('CreateOffice') : t('EditOffice')}</h2>
          <form onSubmit={view === 'create' ? handleCreateOffice : handleUpdateOffice} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeNickName')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.nickName}
                  onChange={(e) => setOfficeForm({...officeForm, nickName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeMainPhone')}</label>
                <input 
                  required
                  type="tel"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.mainPhone}
                  onChange={(e) => setOfficeForm({...officeForm, mainPhone: e.target.value})}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeStreetAddress')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.streetAddress}
                  onChange={(e) => setOfficeForm({...officeForm, streetAddress: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeCity')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.city}
                  onChange={(e) => setOfficeForm({...officeForm, city: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeStateProvince')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.stateProvince}
                  onChange={(e) => setOfficeForm({...officeForm, stateProvince: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('OfficeZipCode')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.zipCode}
                  onChange={(e) => setOfficeForm({...officeForm, zipCode: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('ManagerFullName')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.managerName}
                  onChange={(e) => setOfficeForm({...officeForm, managerName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('ManagerCellPhone')}</label>
                <input 
                  required
                  type="tel"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={officeForm.managerPhone}
                  onChange={(e) => setOfficeForm({...officeForm, managerPhone: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                type="submit"
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                {view === 'create' ? t('CreateOffice') : t('Save')}
              </button>
              <button 
                type="button"
                onClick={() => setView('list')}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                {t('Cancel')}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {view === 'profile' && selectedOffice && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-blue-100">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
                  <HomeIcon size={40} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-slate-900">{selectedOffice.nickName}</h2>
                    {selectedOffice.officeCode && (
                      <span className="text-sm font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">
                        {selectedOffice.officeCode}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin size={16} /> {selectedOffice.streetAddress}, {selectedOffice.city}, {selectedOffice.stateProvince}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {canEdit && (
                  <>
                    <button 
                      onClick={() => { setOfficeForm({...selectedOffice}); setView('edit'); }}
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title={t('EditOffice')}
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => handleToggleOfficeStatus(selectedOffice)}
                      className={`p-2.5 rounded-xl transition-all ${
                        selectedOffice.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                      }`}
                      title={selectedOffice.status === 'active' ? t('PauseOffice') : t('ResumeOffice')}
                    >
                      {selectedOffice.status === 'active' ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteOffice(selectedOffice.id)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title={t('DeleteOffice')}
                    >
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('MainPhone')}</p>
                <p className="text-slate-900 font-semibold">{selectedOffice.mainPhone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('ZipCode')}</p>
                <p className="text-slate-900 font-semibold">{selectedOffice.zipCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Manager')}</p>
                <p className="text-slate-900 font-semibold">{selectedOffice.managerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('ManagerPhone')}</p>
                <p className="text-slate-900 font-semibold">{selectedOffice.managerPhone}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border-2 border-blue-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t('AssignedAdministrators')}</h3>
                <p className="text-sm text-slate-500">{t('ManageAdminsForThisOffice') || 'Manage administrators assigned to this office.'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" size={16} />
                  <input 
                    type="text"
                    placeholder={t('SearchAssignedAdmins')}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                  />
                </div>
                {canEdit && (
                  <>
                    <button 
                      onClick={() => { setIsPromoting(true); setIsReassigning(false); }}
                      className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all text-sm font-bold"
                    >
                      <Plus size={18} />
                      <span>{t('CreateAdmins')}</span>
                    </button>
                    <button 
                      onClick={() => { setIsReassigning(true); setIsPromoting(false); }}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all text-sm font-bold"
                    >
                      <RefreshCw size={18} />
                      <span>{t('ReassignAdmin')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {isPromoting && (
              <div className="p-6 bg-slate-50 border-b border-slate-100 animate-in fade-in slide-in-from-top-4">
                <div className="max-w-md space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">{t('PromoteUserToAdmin')}</h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder={t('SearchClients')}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={promoteSearchQuery}
                      onChange={(e) => setPromoteSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <select 
                      className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">{t('SelectUserToPromote')}</option>
                      {allUsers
                        .filter(u => u.role === 'client')
                        .filter(u => {
                          const query = promoteSearchQuery.toLowerCase();
                          return (u.displayName || '').toLowerCase().includes(query) ||
                                 (u.email || '').toLowerCase().includes(query) ||
                                 (u.phoneNumber || '').toLowerCase().includes(query);
                        })
                        .map(u => (
                          <option key={`promote-user-option-${u.uid}`} value={u.uid}>{u.displayName} ({u.email})</option>
                        ))}
                    </select>
                    <button 
                      onClick={handlePromoteAdmin}
                      className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-all text-sm font-bold"
                    >
                      {t('Promote')}
                    </button>
                    <button 
                      onClick={() => {
                        setIsPromoting(false);
                        setPromoteSearchQuery('');
                      }}
                      className="bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-sm font-bold"
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isReassigning && (
              <div className="p-6 bg-blue-50 border-b-2 border-blue-100 animate-in fade-in slide-in-from-top-4">
                <div className="max-w-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900">{t('ReassignExistingAdmin')}</h4>
                    <button onClick={() => setIsReassigning(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" size={18} />
                    <input 
                      type="text"
                      placeholder={t('SearchAdminsToReassign')}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={reassignSearchQuery}
                      onChange={(e) => setReassignSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {admins
                      .filter(a => a.officeId !== selectedOffice.id && a.status !== 'paused')
                      .filter(a => 
                        a.displayName.toLowerCase().includes(reassignSearchQuery.toLowerCase()) ||
                        (a.adminId || '').toLowerCase().includes(reassignSearchQuery.toLowerCase()) ||
                        a.email.toLowerCase().includes(reassignSearchQuery.toLowerCase())
                      )
                      .map(admin => (
                        <div key={`reassign-admin-${admin.uid}`} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                              {admin.displayName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{admin.displayName}</p>
                              <p className="text-[10px] text-slate-500">{admin.email} • ID: {admin.adminId}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleReassignAdmin(admin.uid)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1 bg-blue-50 rounded-lg"
                          >
                            {t('AssignToThisOffice')}
                          </button>
                        </div>
                      ))}
                    {admins.filter(a => a.officeId !== selectedOffice.id && a.status !== 'paused').length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-sm italic">
                        {t('NoAdminsAvailableToReassign')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Administrator')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('AdminID')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Status')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {admins
                    .filter(a => a.officeId === selectedOffice.id && a.status === 'active')
                    .filter(a => 
                      a.displayName.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                      (a.adminId || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                      a.email.toLowerCase().includes(adminSearchQuery.toLowerCase())
                    )
                    .map(admin => (
                    <tr key={`office-admin-${admin.uid}`} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                            {admin.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {admin.displayName}
                              <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                                {t('Administrator')}
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-500">{admin.email}</p>
                            <AuditInfo audit={admin.audit} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {admin.adminId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          admin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t(admin.status === 'active' ? 'Active' : 'Paused')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setViewingAdmin(admin)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title={t('ViewProfile')}
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingAdmin(admin);
                              setAdminEditForm({ displayName: admin.displayName || '', adminId: admin.adminId || '' });
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title={t('Edit')}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleToggleAdminStatus(admin.uid, admin.status)}
                            className={`p-1.5 rounded-lg transition-all ${
                              admin.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 bg-amber-50'
                            }`}
                            title={admin.status === 'active' ? t('Pause') : t('Resume')}
                          >
                            {admin.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button 
                            onClick={() => {
                              setRevokeAdmin(admin);
                              setRevokeStep(0);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title={t('RevokeAccess')}
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {admins
                    .filter(a => a.officeId === selectedOffice.id)
                    .filter(a => 
                      a.displayName.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                      (a.adminId || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                      a.email.toLowerCase().includes(adminSearchQuery.toLowerCase())
                    ).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        {t('NoAdministratorsFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">{t('EditAdministrator')}</h3>
              <button onClick={() => setEditingAdmin(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateAdmin} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('FullName')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={adminEditForm.displayName}
                  onChange={(e) => setAdminEditForm({...adminEditForm, displayName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('AdminID')}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={adminEditForm.adminId}
                  onChange={(e) => setAdminEditForm({...adminEditForm, adminId: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  {t('Save')}
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {viewingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl my-8 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">{t('AdminProfile')}</h3>
              <div className="flex items-center gap-2">
                {!isEditingAdminProfile && (
                  <button 
                    onClick={() => setIsEditingAdminProfile(true)}
                    className="text-blue-600 hover:underline text-sm font-semibold px-3 py-1 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    {t('Edit')}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setViewingAdmin(null);
                    setIsEditingAdminProfile(false);
                  }} 
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {isEditingAdminProfile ? (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await updateDoc(doc(db, 'users', viewingAdmin.uid), {
                      ...viewingAdmin,
                      updatedAt: new Date().toISOString()
                    });
                    toast.success(t('AdminUpdated'));
                    setIsEditingAdminProfile(false);
                  } catch (error) {
                    console.error(error);
                  }
                }} 
                className="p-6 space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('FullName')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.displayName || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, displayName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('PhoneNumber')}</label>
                    <input 
                      required
                      type="tel"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.phoneNumber || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, phoneNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('JobTitle')}</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.jobTitle || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">{t('TopSpecialties')}</label>
                    <textarea 
                      rows={6}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      placeholder={t('TopSpecialtiesPlaceholder') || "Enter top specialties (up to 100 words)..."}
                      value={viewingAdmin.topSpecialties || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, topSpecialties: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('DateOfBirth')}</label>
                    <input 
                      required
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.dob || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, dob: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('StreetAddress')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.streetAddress || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, streetAddress: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('City')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.city || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('ZipCode')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.zipCode || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('StateProvince')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.stateProvince || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, stateProvince: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('Country')}</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.country || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, country: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('Email')}</label>
                    <input 
                      required
                      type="email"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={viewingAdmin.email || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">{t('CalendarLink')}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="url"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="https://calendar.google.com/..."
                        value={viewingAdmin.calendarUrl || ''}
                        onChange={(e) => setViewingAdmin({...viewingAdmin, calendarUrl: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">{t('Languages')}</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. English, Spanish"
                      value={viewingAdmin.languages || ''}
                      onChange={(e) => setViewingAdmin({...viewingAdmin, languages: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    {t('Save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsEditingAdminProfile(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <UserIcon size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">{viewingAdmin.displayName}</h4>
                      <AuditInfo audit={normalizeAudit(viewingAdmin.audit)} />
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        viewingAdmin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t(viewingAdmin.status === 'active' ? 'Active' : 'Paused')}
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {t('Administrator')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">{t('AdminID')}</p>
                    <p className="text-lg font-mono font-bold text-blue-600">{viewingAdmin.adminId}</p>
                  </div>
                </div>

                {viewingAdmin.isSupervisor && (
                  <button 
                    onClick={() => navigate('/admin/supervision-data')}
                    className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={20} />
                    {t('SupervisionData')}
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4">
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Mail size={18} className="text-slate-400" />
                    <span className="text-sm">{viewingAdmin.email}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Phone size={18} className="text-slate-400" />
                    <span className="text-sm">{viewingAdmin.phoneNumber || t('NotProvided')}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Briefcase size={18} className="text-slate-400" />
                    <span className="text-sm">
                      {viewingAdmin.role === 'admin' ? 'TRUSTED EXPERT' : (viewingAdmin.jobTitle || t('NotProvided'))}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Globe size={18} className="text-slate-400" />
                    <span className="text-sm">{viewingAdmin.languages || t('NotProvided')}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Cake size={18} className="text-slate-400" />
                    <span className="text-sm">
                      {viewingAdmin.dob ? safeFormat(viewingAdmin.dob + 'T00:00:00', 'PP') : t('NotProvided')}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400 md:col-span-2">
                    <Award size={18} className="text-slate-400 mt-1" />
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {viewingAdmin.topSpecialties || t('NotProvided')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 md:col-span-2">
                    <Hash size={18} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('OfficeIDNumber')}</span>
                      <span className="text-sm font-mono font-bold text-blue-600">
                        {viewingAdmin.officeIdNumber || t('NotAssigned')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400 md:col-span-2">
                    <MapPin size={18} className="text-slate-400 mt-1" />
                    <div className="flex flex-col">
                      <span className="text-sm">{viewingAdmin.streetAddress || t('NotProvided')}</span>
                      <span className="text-xs text-slate-500">
                        {[viewingAdmin.city, viewingAdmin.stateProvince, viewingAdmin.zipCode].filter(Boolean).join(', ')}
                      </span>
                      <span className="text-xs text-slate-500">{viewingAdmin.country}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 md:col-span-2">
                    <Globe size={18} className="text-slate-400" />
                    {viewingAdmin.calendarUrl ? (
                      <a 
                        href={viewingAdmin.calendarUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {viewingAdmin.calendarUrl}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-sm">{t('NotProvided')}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 md:col-span-2">
                    <Clock size={18} className="text-slate-400" />
                    <span className="text-sm">
                      {t('JoinedOn', { date: safeFormat(viewingAdmin.createdAt, 'PPpp') || t('Unknown') })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
      {/* Supervision Management removed - now a full page */}
      <RevokeAdminModal />
      
      {/* Revoked Administrators Block */}
      {view === 'list' && (
        <div className="mt-12 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('RevokedAdministrators')}</h3>
                <p className="text-xs text-slate-500">{t('RevokedAdministratorsDesc')}</p>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                <Trash2 size={20} />
              </div>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder={t('SearchRevokedAdmins')}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-xs transition-all"
                  value={deletedAdminsSearchQuery}
                  onChange={(e) => setDeletedAdminsSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {deletedAdmins
                  .filter(a => 
                    a.displayName.toLowerCase().includes(deletedAdminsSearchQuery.toLowerCase()) ||
                    a.email.toLowerCase().includes(deletedAdminsSearchQuery.toLowerCase())
                  )
                  .map(admin => (
                    <div key={`pause-admin-${admin.uid}`} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-red-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 font-bold text-[10px] border border-slate-100 dark:border-slate-600">
                          {admin.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{admin.displayName}</p>
                          <p className="text-[10px] text-slate-500">{admin.email}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setViewingAdmin(admin)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          title={t('ViewProfile')}
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => handleRestoreAdmin(admin)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all"
                          title={t('RestoreAdmin', 'Restore Administrator')}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                {deletedAdmins.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-400 italic">{t('NoRevokedAdminsFound')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const AdminDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mission, setMission] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState('All');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userJoinedDateFilter, setUserJoinedDateFilter] = useState('');
  const [userJoinedEndDateFilter, setUserJoinedEndDateFilter] = useState('');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignedToOthersSearchTerm, setAssignedToOthersSearchTerm] = useState('');
  const [assignedToOthersStatusFilter, setAssignedToOthersStatusFilter] = useState('All');
  const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
  const [deletedUserSearchTerm, setDeletedUserSearchTerm] = useState('');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc');
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [googleDriveAudit, setGoogleDriveAudit] = useState<AuditMetadata | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [showWarning1, setShowWarning1] = useState(false);
  const [showWarning2, setShowWarning2] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const { profile, isAdmin, isSeniorAdmin, canEdit } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; type: 'email' | 'call'; targetUserId: string }>({ isOpen: false, type: 'email', targetUserId: '' });

  useEffect(() => {
    if (profile && profile.role === 'admin') {
      logGlobalAudit(profile, `Visited Page`, 'access', `Navigated to ${location.pathname}`);
    }
  }, [location.pathname, profile?.uid]);

  useEffect(() => {
    const demoteUser = async () => {
      const targetEmail = 'josiliench424@gmail.com';
      const userToDemote = users.find(u => u.email === targetEmail && u.role === 'admin');
      if (userToDemote) {
        try {
          await updateDoc(doc(db, 'users', userToDemote.uid), {
            role: 'client',
            adminId: null,
            adminRank: null,
            officeId: null,
            updatedAt: new Date().toISOString(),
            audit: arrayUnion(getAuditMetadata(profile, 'Revoked administrator access (demoted to client)'))
          });
          toast.info(`User ${targetEmail} has been demoted to client.`);
        } catch (error) {
          console.error("Error demoting user:", error);
        }
      }
    };
    if (isAdmin && users.length > 0) {
      demoteUser();
    }
  }, [users, isAdmin, profile]);

  const downloadUsersList = (formatType: 'pdf' | 'csv') => {
    const data = filteredUsers.map(u => ({
      name: u.displayName,
      email: u.email,
      phone: u.phoneNumber || '-'
    }));

    const dateRangeStr = userJoinedDateFilter && userJoinedEndDateFilter 
      ? `${userJoinedDateFilter}_to_${userJoinedEndDateFilter}`
      : userJoinedDateFilter || userJoinedEndDateFilter || 'all';

    if (formatType === 'pdf') {
      const doc = new jsPDF();
      doc.text(t('AllUsers'), 14, 15);
      autoTable(doc, {
        head: [[t('Name'), t('Email'), t('Phone')]],
        body: data.map(item => [item.name, item.email, item.phone]),
        startY: 20,
      });
      doc.save(`users_list_${dateRangeStr}.pdf`);
    } else {
      const csvContent = [
        [t('Name'), t('Email'), t('Phone')].join(','),
        ...data.map(item => [item.name, item.email, item.phone].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `users_list_${dateRangeStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    logGlobalAudit(profile, 'Download Users List', 'system', `Downloaded all users list in ${formatType} format`);
    toast.success(t('FileDownloaded') || 'File downloaded successfully');
  };

  const handleEmailClick = (user: UserProfile) => {
    if (!user.email) return;
    logInteraction('email', user, profile);
    window.open(`mailto:${user.email}`, '_blank');
  };

  const handlePhoneClick = (user: UserProfile) => {
    if (!user.phoneNumber) return;
    logInteraction('call', user, profile);
    window.open(`tel:${user.phoneNumber}`, '_blank');
  };

  const isUsersView = location.pathname === '/admin/users';

  useEffect(() => {
    if (!isAdmin) return;
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', userSortOrder));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const qApps = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    const unsubscribeOffices = onSnapshot(collection(db, 'offices'), (snapshot) => {
      setOffices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Office)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'offices'));

    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'services'));

    return () => {
      unsubscribeUsers();
      unsubscribeApps();
      unsubscribeOffices();
      unsubscribeServices();
    };
  }, [userSortOrder, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ninetyDaysAgo = subDays(new Date(), 90).toISOString();
    const qDeleted = query(
      collection(db, 'deleted_users'), 
      where('deletedAt', '>=', ninetyDaysAgo),
      orderBy('deletedAt', 'desc')
    );
    const unsubscribeDeleted = onSnapshot(qDeleted, (snapshot) => {
      setDeletedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'deleted_users'));

    return () => unsubscribeDeleted();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(doc(db, 'global_config', 'google_drive'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGoogleDriveLink(data.link || '');
        setGoogleDriveAudit(data.audit || null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'global_config/google_drive'));
    return () => unsubscribe();
  }, [isAdmin]);

  const handleSaveGoogleDriveLink = async (link: string) => {
    setIsSavingLink(true);
    try {
      const audit = getAuditMetadata(profile, 'Updated Google Drive link');
      await setDoc(doc(db, 'global_config', 'google_drive'), { 
        link,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.uid,
        audit
      });
      toast.success(t('GoogleDriveLinkSaved') || 'Google Drive link saved successfully.');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleGoogleDriveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!googleDriveLink) return;
    setShowWarning1(true);
  };

  const handleRestoreUser = async (deletedUser: any) => {
    try {
      // Check if an active user with the same email already exists
      const qActive = query(collection(db, 'users'), where('email', '==', deletedUser.email));
      const activeSnapshot = await getDocs(qActive);
      
      const audit = getAuditMetadata(profile, `Restored user: ${deletedUser.displayName}`);
      let finalData = {
        ...deletedUser.originalData,
        restoredBy: profile?.adminId || null,
        restoredAt: new Date().toISOString(),
        status: 'active',
        activeFlag: deletedUser.originalData.activeFlag || 'green',
        audit
      };
      let targetUid = deletedUser.uid;
      const oldUid = deletedUser.uid;

      if (!activeSnapshot.empty) {
        const activeDoc = activeSnapshot.docs[0];
        const activeData = activeDoc.data() as UserProfile;
        targetUid = activeDoc.id;
        
        // Merge accounts
        finalData = {
          ...activeData, // Keep new data as base
          ...deletedUser.originalData, // Overwrite with old data where applicable
          uid: targetUid,
          phoneNumber: activeData.phoneNumber, // Keep new phone number as primary
          secondaryPhoneNumber: deletedUser.originalData.phoneNumber, // Keep old phone number as secondary
          restoredBy: profile?.adminId || null,
          restoredAt: new Date().toISOString(),
          mergedAt: new Date().toISOString(),
          previousUid: oldUid,
          status: 'active',
          audit
        };

        // Merge related collections from oldUid to targetUid
        // 1. Update appointments
        const qApps = query(collection(db, 'appointments'), where('clientId', '==', oldUid));
        const appsSnap = await getDocs(qApps);
        const appUpdates = appsSnap.docs.map(d => updateDoc(doc(db, 'appointments', d.id), { clientId: targetUid }));
        await Promise.all(appUpdates);

        // 2. Update user_custom_services
        const qCustom = query(collection(db, 'user_custom_services'), where('clientId', '==', oldUid));
        const customSnap = await getDocs(qCustom);
        const customUpdates = customSnap.docs.map(d => updateDoc(doc(db, 'user_custom_services', d.id), { clientId: targetUid }));
        await Promise.all(customUpdates);

        // 3. Update referrals
        const qReferred = query(collection(db, 'users'), where('referrerId', '==', oldUid));
        const referredSnap = await getDocs(qReferred);
        const referredUpdates = referredSnap.docs.map(d => updateDoc(doc(db, 'users', d.id), { referrerId: targetUid }));
        await Promise.all(referredUpdates);
      }

      // Restore to users collection
      await setDoc(doc(db, 'users', targetUid), finalData);
      
      // Remove from deleted_users collection
      await deleteDoc(doc(db, 'deleted_users', deletedUser.uid));
      
      toast.success(t('UserRestoredSuccessfully', { name: deletedUser.displayName }));
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error(t('FailedToRestoreUserProfile'));
    }
  };

  // Process data for counts
  const today = new Date();
  const last24h = subHours(new Date(), 24).toISOString();
  const unassigned24hCount = appointments.filter(app => {
    const clientExists = users.some(u => u.uid === app.clientId);
    return clientExists && !app.assignedAdminId && app.status !== 'Cancelled' && app.createdAt <= last24h;
  }).length;
  const uncompletedPaidCount = appointments.filter(app => app.status !== 'Complete' && app.status !== 'Cancelled' && (app.paymentStatus === 'PaPay' || app.paymentStatus === 'FullPay')).length;
  const birthdayUsers = users.filter(u => {
    if (!u.dob) return false;
    const rolesToInclude = ['admin', 'client', 'employee'];
    if (!rolesToInclude.includes(u.role)) return false;
    const [year, month, day] = u.dob.split('-').map(Number);
    return day === today.getDate() && (month - 1) === today.getMonth();
  });

  const [cancellingAppId, setCancellingAppId] = useState<string | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);

  const todaysRequestsCount = appointments.filter(a => isSameDay(new Date(a.createdAt), new Date())).length;

  const getReachStatus = (user: UserProfile) => {
    if (!user.reachStatus) return { green: false, yellow: false };
    const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
    if (Date.now() - user.reachStatus.updatedAt > sixtyDaysInMs) {
      return { green: false, yellow: false };
    }
    return user.reachStatus;
  };

  const handleReachToggle = async (user: UserProfile, color: 'green' | 'yellow') => {
    const currentStatus = getReachStatus(user);
    const newStatus = {
      ...currentStatus,
      [color]: !currentStatus[color],
      updatedAt: Date.now()
    };
    
    try {
      const audit = getAuditMetadata(profile, `Updated reach status for user`);
      await updateDoc(doc(db, 'users', user.uid), {
        reachStatus: newStatus,
        audit: arrayUnion(audit)
      });
      await logGlobalAudit(profile, 'Update Reach Status', 'profile', `Updated reach status for ${user.displayName} to ${color}`, user.uid, user.displayName);
      toast.success(t('StatusUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const appInfo = appointments.find(a => a.id === id);
    if (profile?.role === 'admin' && appInfo?.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    if (status === 'Cancelled') {
      setCancellingAppId(id);
      setShowCancelWarning(true);
      return;
    }
    try {
      const audit = getAuditMetadata(profile, `Updated appointment status to ${status}`);
      await updateDoc(doc(db, 'appointments', id), { status, audit });
      
      const app = appointments.find(a => a.id === id);
      if (app) {
        await logGlobalAudit(profile, 'Update Service Status', 'service', `Updated status of ${app.service} to ${status}`, app.id);
        sendNotification(
          app.clientId,
          t('ServiceStatusUpdated'),
          t('YourServiceStatusUpdatedTo', { service: app.service, status: t(status) }),
          'info',
          '/portal/appointments'
        );
      }

      toast.success(t('AppointmentStatusUpdated', { status: t(status) }));
    } catch (error) {
      toast.error(t('FailedToUpdateStatus'));
    }
  };

  const updatePaymentStatus = async (appointment: Appointment, paymentStatus: string, partialPayments?: PartialPayment[], paymentMethod?: string) => {
    // SAFETY CHECK: Administrators cannot perform actions for themselves
    if (profile?.role === 'admin' && appointment.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }

    try {
      let finalStatus = paymentStatus;
      if (paymentStatus === 'PaPay' && partialPayments) {
        const totalPaid = partialPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const fee = getServiceFee(appointment.service);
        if (fee > 0 && totalPaid >= fee) {
          finalStatus = 'FullPay';
        }
      }

      const audit = getAuditMetadata(profile, `Updated payment status to ${finalStatus}${paymentMethod ? ` with method ${paymentMethod}` : ''}`);
      const updateData: any = { paymentStatus: finalStatus, audit };
      if (partialPayments) {
        updateData.partialPayments = partialPayments;
      }
      if (paymentMethod) {
        updateData.paymentMethod = paymentMethod;
      }
      await updateDoc(doc(db, 'appointments', appointment.id), updateData);
      await logGlobalAudit(profile, 'Update Payment Status', 'service', `Updated payment status of ${appointment.service} to ${finalStatus}`, appointment.id);
      toast.success(`${t('PaymentStatusUpdatedTo')} ${t(finalStatus)}`);
    } catch (error) {
      toast.error(t('FailedToUpdatePaymentStatus'));
    }
  };

const handleAssignService = async () => {
    if (!selectedAppointment) {
      toast.error(t('NoServiceSelected'));
      return;
    }
    if (!selectedAdminId) {
      toast.error(t('PleaseSelectAnAdministrator'));
      return;
    }
    
    // SAFETY CHECK: Administrators cannot perform actions for themselves
    if (profile?.role === 'admin' && selectedAppointment.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked', "An administrator cannot perform an action on their own account."));
      return;
    }

    const admin = users.find(u => u.uid === selectedAdminId);
    if (!admin) {
      toast.error(t('AdminNotFound'));
      return;
    }

    try {
      const assignerJobId = profile?.adminId || (profile?.adminRank === 'super' ? '000' : '');
      const audit = getAuditMetadata(profile, `Assigned service to ${admin.displayName}`);
      
      const updateData: any = {
        assignedAdminId: admin.uid,
        assignedAdminName: admin.displayName,
        assignedAdminJobId: admin.adminId || (admin.adminRank === 'super' ? '000' : ''),
        assignedBy: profile?.uid || null,
        assignerAdminJobId: assignerJobId,
        assignerAdminName: profile?.displayName || null,
        mission: mission || null,
        audit
      };

      if (dueDate) {
        updateData.dueDate = dueDate;
      }

      await updateDoc(doc(db, 'appointments', selectedAppointment.id), updateData);

      await logGlobalAudit(profile, 'Assign Service', 'service', `Assigned ${selectedAppointment.service} to admin ${admin.displayName}`, selectedAppointment.id, admin.displayName);

      // Send notification to admin
      sendNotification(
        admin.uid,
        t('NewServiceAssigned'),
        t('YouHaveBeenAssignedANewService', { service: selectedAppointment.service }),
        'info',
        '/admin'
      );

      // Send notification to client
      sendNotification(
        selectedAppointment.clientId,
        t('ServiceAssigned'),
        t('YourServiceHasBeenAssignedToAdmin', { service: selectedAppointment.service, admin: admin.displayName }),
        'info',
        '/portal/appointments'
      );

      toast.success(`${t('ServiceAssignedTo')} ${admin.displayName}`);
      setShowAssignModal(false);
      setSelectedAppointment(null);
      setSelectedAdminId('');
      setDueDate('');
      setMission('');
    } catch (error) {
      toast.error(t('FailedToAssignService'));
    }
  };

  const assignedAppointments = appointments.filter(app => {
    if (app.assignedAdminId !== profile?.uid) return false;
    if (app.status === 'Cancelled') return false;
    const searchLower = assignmentSearchTerm.toLowerCase();
    const client = users.find(u => u.uid === app.clientId);
    return (
      (app.service || '').toLowerCase().includes(searchLower) ||
      (client?.displayName || '').toLowerCase().includes(searchLower) ||
      (client?.email || '').toLowerCase().includes(searchLower) ||
      (app.assignedAdminJobId || '').toLowerCase().includes(searchLower) ||
      (app.assignerAdminJobId || '').toLowerCase().includes(searchLower) ||
      (app.mission || '').toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    // Unaccomplished first
    if (!a.missionAccomplished && b.missionAccomplished) return -1;
    if (a.missionAccomplished && !b.missionAccomplished) return 1;

    if (!a.missionAccomplished) {
      // Both unaccomplished: sort by due date
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else {
      // Both accomplished: sort by completion date
      if (!a.missionAccomplishedAt) return 1;
      if (!b.missionAccomplishedAt) return -1;
      return new Date(a.missionAccomplishedAt).getTime() - new Date(b.missionAccomplishedAt).getTime();
    }
  });

  const assignedToOthersAppointments = appointments.filter(app => {
    // Filter by assigner's UID or Admin ID to show services assigned by the current administrator
    const isAssigner = app.assignedBy === profile?.uid || app.assignedBy === profile?.adminId || app.assignerAdminJobId === profile?.adminId;
    if (!isAssigner) return false;
    
    const searchLower = assignedToOthersSearchTerm.toLowerCase();
    const client = users.find(u => u.uid === app.clientId);
    const matchesSearch = (
      (app.service || '').toLowerCase().includes(searchLower) ||
      (client?.displayName || '').toLowerCase().includes(searchLower) ||
      (client?.email || '').toLowerCase().includes(searchLower) ||
      (app.assignedAdminJobId || '').toLowerCase().includes(searchLower) ||
      (app.assignerAdminJobId || '').toLowerCase().includes(searchLower) ||
      (app.mission || '').toLowerCase().includes(searchLower)
    );
    const matchesStatus = assignedToOthersStatusFilter === 'All' || app.status === assignedToOthersStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(user => {
    if (user.isEmployee) return false;
    const searchLower = userSearchTerm.toLowerCase();
    const matchesSearch = (
      (user.displayName || '').toLowerCase().includes(searchLower) ||
      (user.email || '').toLowerCase().includes(searchLower) ||
      (user.phoneNumber || '').toLowerCase().includes(searchLower)
    );
    
    if (userJoinedDateFilter || userJoinedEndDateFilter) {
      const userDate = safeFormat(user.createdAt, 'yyyy-MM-dd');
      if (userJoinedDateFilter && userJoinedEndDateFilter) {
        return matchesSearch && userDate >= userJoinedDateFilter && userDate <= userJoinedEndDateFilter;
      } else if (userJoinedDateFilter) {
        return matchesSearch && userDate >= userJoinedDateFilter;
      } else if (userJoinedEndDateFilter) {
        return matchesSearch && userDate <= userJoinedEndDateFilter;
      }
    }
    
    return matchesSearch;
  });

  const filteredAdmins = users.filter(user => {
    if (user.role !== 'admin') return false;
    const searchLower = adminSearchTerm.toLowerCase();
    return (
      (user.displayName || '').toLowerCase().includes(searchLower) ||
      (user.adminId || '').toLowerCase().includes(searchLower) ||
      (user.email || '').toLowerCase().includes(searchLower) ||
      (user.officePhone || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-900">
            {isUsersView ? t('Users') : t('AdminDashboard')}
          </h1>
          <p className="text-sm md:text-base text-slate-500">
            {isUsersView ? t('ManageUsersDesc') : t('AdminDashboardDesc')}
          </p>
          {!isUsersView && profile?.isSupervisor && (
            <button 
              onClick={() => navigate('/admin/supervision-data')}
              className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={20} />
              {t('SupervisionData')}
            </button>
          )}
        </div>
        {/* Add Admin button removed per user request */}
      </div>

      {!isUsersView && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col items-start gap-2 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('TotalClients')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{users.filter(u => u.role === 'client').length}</p>
          </div>
          <div 
            onClick={() => setShowBirthdayModal(true)}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group"
          >
            <div className="flex flex-col items-start gap-2 mb-2">
              <div className="p-2 bg-pink-50 text-pink-600 rounded-lg group-hover:scale-110 transition-transform">
                <Cake size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('Birthdays')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{birthdayUsers.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex flex-col items-start gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <CheckCircle size={20} />
              </div>
              <span className="text-sm font-bold text-slate-700 uppercase tracking-tight leading-tight">
                {t('TodaysServiceRequest', "Today's Service Request")}
              </span>
            </div>
            <p className="text-4xl font-extrabold text-slate-900">{todaysRequestsCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col items-start gap-2 mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Clock size={20} />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('Unassigned24h')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{unassigned24hCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col items-start gap-2 mb-2">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('UncompletedPaid')}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{uncompletedPaidCount}</p>
          </div>
        </div>

      <AnimatePresence>
        {showAssignModal && selectedAppointment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">{t('AssignService')}</h3>
                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('Service')}</p>
                  <p className="font-medium text-slate-900">{selectedAppointment.service}</p>
                  <p className="text-xs text-slate-500 mt-2">{t('User')}: {users.find(u => u.uid === selectedAppointment.clientId)?.displayName}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('SelectAdmin')}</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedAdminId}
                    onChange={e => setSelectedAdminId(e.target.value)}
                  >
                    <option value="">{t('ChooseAdmin')}</option>
                    {users.filter(u => u.role === 'admin' && u.status !== 'paused').map(admin => (
                      <option key={`assign-admin-option-${admin.uid}`} value={admin.uid}>
                        {admin.displayName} ({admin.adminRank || 'Admin'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('DueDateAndTime')}</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('Mission')}</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                    placeholder={t('EnterMissionDesc')}
                    value={mission}
                    onChange={e => setMission(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleAssignService}
                  disabled={!selectedAdminId}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('AssignNow')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showBirthdayModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                    <Cake size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{t('TodaysBirthdays')}</h3>
                </div>
                <button onClick={() => setShowBirthdayModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {birthdayUsers.length > 0 ? (
                  birthdayUsers.map(user => (
                    <div key={`birthday-user-${user.uid}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">
                          {user.displayName ? user.displayName[0] : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.displayName}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{t(user.role)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-pink-600 uppercase">{t('HappyBirthday')}</p>
                        <p className="text-[10px] text-slate-400">{safeFormat(user.dob, 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500">{t('NoBirthdays')}</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setShowBirthdayModal(false)}
                className="w-full mt-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                {t('Close')}
              </button>
            </motion.div>
          </div>
        )}

        <YellowWarningModal 
          isOpen={showCancelWarning}
          onClose={() => {
            setShowCancelWarning(false);
            setCancellingAppId(null);
          }}
          requireReason={isAdmin}
          onConfirm={async (reason) => {
            if (cancellingAppId) {
    const app = appointments.find(a => a.id === cancellingAppId);
    if (!app) return;
    
    if (profile?.role === 'admin' && app.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    try {
      await updateDoc(doc(db, 'appointments', cancellingAppId), { 
        status: 'Cancelled',
        cancellationReason: reason || null,
        audit: getAuditMetadata(profile, `Cancelled service request${reason ? `: ${reason}` : ''}`)
      });
      await logGlobalAudit(profile, 'Cancel Service', 'service', `Cancelled ${app.service}${reason ? ` (Reason: ${reason})` : ''}`, app.id);
      toast.success(t('AppointmentStatusUpdated', { status: t('Cancelled') }));
              } catch (error) {
                toast.error(t('FailedToUpdateStatus'));
              }
            }
          }}
          title={t('CancelServiceWarningTitle') || 'Cancel Requested Service?'}
          message={t('CancelServiceWarningMessage') || 'Warning: This action will cancel the service request. This cannot be undone.'}
          confirmText={t('ConfirmCancellation') || 'Confirm Cancellation'}
        />
      </AnimatePresence>

      <AdminAnalytics users={users} appointments={appointments} />

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('RealTimeServiceRequests')}
                <span className="ml-2 text-blue-600">({appointments.filter(a => a.status === 'Process' || a.status === 'New' || a.status === 'Complete').length})</span>
              </h2>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder={t('SearchByNameOrEmail')}
                    className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={serviceStatusFilter}
                  onChange={(e) => setServiceStatusFilter(e.target.value)}
                >
                  <option value="All">{t('AllStatuses') || 'All Statuses'}</option>
                  <option value="New">{t('New')}</option>
                  <option value="Process">{t('Process')}</option>
                  <option value="Complete">{t('Complete')}</option>
                  <option value="Cancelled">{t('Cancelled')}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">#</th>
                    <th className="px-6 py-4 font-bold">{t('User')}</th>
                    <th className="px-6 py-4 font-bold">{t('Service')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('RequestedAt')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Mission')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Assign')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {appointments
                    .filter(a => a.status === 'Process' || a.status === 'New' || a.status === 'Complete')
                    .filter(app => {
                      const client = users.find(u => u.uid === app.clientId);
                      const searchLower = serviceSearchTerm.toLowerCase();
                      const matchesSearch = (
                        app.service.toLowerCase().includes(searchLower) ||
                        client?.displayName?.toLowerCase().includes(searchLower) ||
                        client?.email?.toLowerCase().includes(searchLower)
                      );
                      const matchesStatus = serviceStatusFilter === 'All' || app.status === serviceStatusFilter;
                      return matchesSearch && matchesStatus;
                    })
                    .map((app, index) => {
                    const client = users.find(u => u.uid === app.clientId);
                    return (
                      <tr key={`dashboard-realtime-${app.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{client?.displayName || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{client?.email}</p>
                          {app.requestedByAdminId && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium italic mt-1">
                              {t('RequestedBy')}: ({app.requestedByAdminId})
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300">{app.service}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                          {safeFormat(app.createdAt, 'MMM d, yyyy, h:mm a')}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 text-center max-w-[150px]">
                          <div className="truncate" title={app.mission}>
                            {app.mission || <span className="text-slate-300 dark:text-slate-700 italic">N/A</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select 
                            disabled={!canEdit}
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded border outline-none transition-colors ${
                              !canEdit ? 'opacity-50 cursor-not-allowed' : ''
                            } ${getStatusStyles(app.status || 'Process')}`}
                            value={app.status || 'Process'}
                            onChange={(e) => updateStatus(app.id, e.target.value)}
                          >
                            <option value="New" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t('New')}</option>
                            <option value="Process" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t('Process')}</option>
                            <option value="Complete" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t('Complete')}</option>
                            {(app.status || 'Process') !== 'Complete' && (
                              <option value="Cancelled" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t('Cancelled')}</option>
                            )}
                          </select>
                          <div className="mt-1">
                            <AuditInfo audit={app.audit} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {canEdit && (
                            <button 
                              onClick={() => {
                                setSelectedAppointment(app);
                                setShowAssignModal(true);
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                app.assignedAdminId 
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                                  : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                              }`}
                              title={app.assignedAdminId ? `${t('AssignedTo')} ${app.assignedAdminName}` : t('AssignToAdmin')}
                            >
                              <Users size={18} className={app.assignedAdminId ? "text-blue-600" : "text-yellow-600"} />
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => navigate(`/admin/users/${app.clientId}`)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <ChevronRight size={18} className="text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-blue-500 flex justify-between items-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('TotalRequests', 'Total Requests')}
              </p>
              <p className="text-lg font-bold text-blue-600">
                {appointments.filter(a => a.status === 'Process' || a.status === 'New' || a.status === 'Complete').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('ServicesAssignedToMe', 'Services Assigned to Me')}
                  <span className="ml-2 text-blue-600">({assignedAppointments.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('ServiceAssignmentsDesc')}</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder={t('SearchAssignments') || "Search assignments..."}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  value={assignmentSearchTerm}
                  onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-blue-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">#</th>
                    <th className="px-6 py-4 font-bold">{t('RequestedService', 'Requested Service')}</th>
                    <th className="px-6 py-4 font-bold">{t('AssignersName', "Assigner's Name")}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('AssignersAdminID', "Assigner's Admin ID")}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Mission')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Due Date')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('LastAction', 'Last Action')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedAppointments.length > 0 ? (
                    assignedAppointments.map((app, index) => {
                      const isDueSoon = app.dueDate && !app.missionAccomplished && (new Date(app.dueDate).getTime() - new Date().getTime()) < (48 * 60 * 60 * 1000);
                      
                      return (
                        <tr key={`dashboard-assigned-me-${app.id}`} className={`hover:bg-slate-50 transition-colors ${isDueSoon ? 'bg-yellow-50/50' : ''}`}>
                          <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{app.service}</p>
                            <p className="text-xs text-slate-500">
                              {t('User')}: {users.find(u => u.uid === app.clientId)?.displayName} • {safeFormat(app.createdAt, 'MMM d, yyyy')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">
                              {app.assignerAdminJobId 
                                ? (users.find(u => u.adminId === app.assignerAdminJobId && u.role === 'admin')?.displayName || app.assignerAdminName || 'Unknown')
                                : (app.assignerAdminName || 'Unknown')}
                            </p>
                            {app.assignerAdminJobId && (
                              <p className="text-[10px] text-slate-500 italic mt-1">
                                ({t('AdminID', 'Admin ID')}: {app.assignerAdminJobId})
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 text-center">
                            {app.assignerAdminJobId || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 text-center max-w-[200px]">
                            <div className="flex items-center justify-center gap-2">
                              <div className="truncate" title={app.mission}>
                                {app.mission || <span className="text-slate-300 italic">N/A</span>}
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const newStatus = !app.missionAccomplished;
                                    await updateDoc(doc(db, 'appointments', app.id), {
                                      missionAccomplished: newStatus,
                                      missionAccomplishedAt: newStatus ? new Date().toISOString() : null,
                                      audit: arrayUnion(getAuditMetadata(profile, `Toggled mission status to ${newStatus ? 'Accomplished' : 'Pending'}`))
                                    });
                                    await logGlobalAudit(profile, 'Update Mission Status', 'service', `Marked mission for ${app.service} as ${newStatus ? 'Accomplished' : 'Pending'}`, app.id);
                                    toast.success(t('MissionStatusUpdated', 'Mission status updated'));
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, 'appointments');
                                  }
                                }}
                                className={`p-1 rounded-full transition-colors ${app.missionAccomplished ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-green-500 hover:bg-slate-100'}`}
                              >
                                <CheckCircle size={18} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {app.dueDate ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                app.missionAccomplished ? 'bg-green-100 text-green-700' : 
                                isDueSoon ? 'bg-yellow-200 text-yellow-800 animate-pulse' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {safeFormat(app.dueDate, 'MMM d, h:mm a')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">{t('NoDueDate')}</span>
                            )}
                          </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusStyles(app.status)}`}>
                            {t(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]" title={getLastAction(app.audit)}>
                              {getLastAction(app.audit)}
                            </span>
                            <AuditInfo audit={app.audit} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => navigate(`/admin/users/${app.clientId}`)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <ChevronRight size={18} className="text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        {t('NoAssignments')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <p className="text-sm font-bold text-slate-700">
                {t('Total')}: {assignedAppointments.length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('ServicesIAssignedToAdmins', 'Services I Assigned to Administrators')}
                  <span className="ml-2 text-blue-600">({assignedToOthersAppointments.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('ServicesAssignedToOthersDesc', 'Detailed list of services you assigned to other administrators.')}</p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder={t('SearchAssignments') || "Search assignments..."}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    value={assignedToOthersSearchTerm}
                    onChange={(e) => setAssignedToOthersSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={assignedToOthersStatusFilter}
                  onChange={(e) => setAssignedToOthersStatusFilter(e.target.value)}
                >
                  <option value="All">{t('AllStatuses') || 'All Statuses'}</option>
                  <option value="New">{t('New')}</option>
                  <option value="Process">{t('Process')}</option>
                  <option value="Complete">{t('Complete')}</option>
                  <option value="Cancelled">{t('Cancelled')}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-blue-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">#</th>
                    <th className="px-6 py-4 font-bold">{t('RequestedService', 'Requested Service')}</th>
                    <th className="px-6 py-4 font-bold">{t('Assigned Administrator')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('AdminID', 'Admin ID')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Mission')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Due Date')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('LastAction', 'Last Action')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedToOthersAppointments.length > 0 ? (
                    assignedToOthersAppointments.map((app, index) => (
                      <tr key={`dashboard-assigned-others-${app.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{app.service}</p>
                          <p className="text-xs text-slate-500">
                            {t('User')}: {users.find(u => u.uid === app.clientId)?.displayName} • {safeFormat(app.createdAt, 'MMM d, yyyy')}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{app.assignedAdminName}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 text-center">
                          {app.assignedAdminJobId || <span className="text-slate-300 italic">N/A</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 text-center max-w-[200px]">
                          <div className="truncate" title={app.mission}>
                            {app.mission || <span className="text-slate-300 italic">N/A</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {app.dueDate ? (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                              app.status === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {safeFormat(app.dueDate, 'MMM d, h:mm a')}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">{t('NoDueDate')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusStyles(app.status)}`}>
                            {t(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]" title={getLastAction(app.audit)}>
                              {getLastAction(app.audit)}
                            </span>
                            <AuditInfo audit={app.audit} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => navigate(`/admin/users/${app.clientId}`)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <ChevronRight size={18} className="text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        {t('NoAssignments')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <p className="text-sm font-bold text-slate-700">
                {t('Total')}: {assignedToOthersAppointments.length}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isUsersView ? t('AllUsers', 'All Users') : t('RecentUsers')}
            <span className="ml-2 text-blue-600">({filteredUsers.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="relative flex-1 md:flex-none">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="date"
                  className="pl-9 pr-3 py-1.5 border-none bg-transparent text-xs outline-none focus:ring-0 w-full md:w-36 text-slate-900 dark:text-white"
                  value={userJoinedDateFilter}
                  onChange={(e) => setUserJoinedDateFilter(e.target.value)}
                  title={t('StartDate')}
                />
              </div>
              <div className="text-slate-400 text-xs font-bold">to</div>
              <div className="relative flex-1 md:flex-none">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="date"
                  className="pl-9 pr-3 py-1.5 border-none bg-transparent text-xs outline-none focus:ring-0 w-full md:w-36 text-slate-900 dark:text-white"
                  value={userJoinedEndDateFilter}
                  onChange={(e) => setUserJoinedEndDateFilter(e.target.value)}
                  title={t('EndDate')}
                />
              </div>
            </div>
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('SearchByContact')}
                className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadUsersList('pdf')}
                className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                title={t('DownloadPDF')}
              >
                <Download size={14} />
                PDF
              </button>
              <button
                onClick={() => downloadUsersList('csv')}
                className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                title={t('DownloadCSV')}
              >
                <Download size={14} />
                CSV
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold w-12">#</th>
                <th className="px-6 py-4 font-bold">{t('User')}</th>
                <th className="px-6 py-4 font-bold">{t('Contact')}</th>
                <th className="px-6 py-4 font-bold">{t('Reach')}</th>
                <th 
                  className="px-6 py-4 font-bold cursor-pointer hover:text-blue-800 transition-colors group"
                  onClick={() => setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center gap-1">
                    {t('Joined')}
                    <div className="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <ArrowUp size={10} className={userSortOrder === 'asc' ? 'text-blue-600 opacity-100' : ''} />
                      <ArrowDown size={10} className={userSortOrder === 'desc' ? 'text-blue-600 opacity-100' : ''} />
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 font-bold">{t('Status')}</th>
                <th className="px-6 py-4 font-bold">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(isUsersView ? filteredUsers : filteredUsers.slice(0, 5)).map((user, index) => (
                <tr key={`dashboard-user-${user.uid}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
                        {user.displayName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{user.displayName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{t(user.role)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setHistoryModal({ isOpen: true, type: 'email', targetUserId: user.uid })}
                        className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"
                        title={t('EmailHistory')}
                      >
                        <Eye size={12} />
                      </button>
                      <button 
                        onClick={() => handleEmailClick(user)}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                      >
                        <Mail size={14} />
                      </button>
                      <p className="text-sm text-slate-900 dark:text-white">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        onClick={() => setHistoryModal({ isOpen: true, type: 'call', targetUserId: user.uid })}
                        className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"
                        title={t('CallHistory')}
                      >
                        <Eye size={12} />
                      </button>
                      <button 
                        onClick={() => handlePhoneClick(user)}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                      >
                        <Phone size={14} />
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.phoneNumber || t('NoPhone')}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReachToggle(user, 'green')}
                        className={`p-1 rounded-full transition-all hover:scale-110 ${getReachStatus(user).green ? 'text-green-500' : 'text-slate-300'}`}
                        title="Contacted (Green)"
                      >
                        <Star size={18} fill={getReachStatus(user).green ? 'currentColor' : 'none'} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => handleReachToggle(user, 'yellow')}
                        className={`p-1 rounded-full transition-all hover:scale-110 ${getReachStatus(user).yellow ? 'text-yellow-500' : 'text-slate-300'}`}
                        title="Contacted (Yellow)"
                      >
                        <Star size={18} fill={getReachStatus(user).yellow ? 'currentColor' : 'none'} strokeWidth={2.5} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {safeFormat(user.createdAt, 'MMM d, yyyy')}
                    <div className="mt-1">
                      <AuditInfo audit={user.audit} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.status === 'active' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {t(user.status === 'active' ? 'Active' : 'Inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => navigate(`/admin/users/${user.uid}`)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    {t('NoUsersFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <p className="text-sm font-bold text-slate-700">
            {t('Total')}: {filteredUsers.length}
          </p>
        </div>
      </div>

      {isUsersView && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('ServicesIAssignedToAdmins', 'Services I Assigned to Administrators')}
                  <span className="ml-2 text-blue-600">({assignedToOthersAppointments.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('ServicesAssignedToOthersDesc', 'Detailed list of services you assigned to other administrators.')}</p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder={t('SearchAssignments') || "Search assignments..."}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    value={assignedToOthersSearchTerm}
                    onChange={(e) => setAssignedToOthersSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={assignedToOthersStatusFilter}
                  onChange={(e) => setAssignedToOthersStatusFilter(e.target.value)}
                >
                  <option value="All">{t('AllStatuses') || 'All Statuses'}</option>
                  <option value="New">{t('New')}</option>
                  <option value="Process">{t('Process')}</option>
                  <option value="Complete">{t('Complete')}</option>
                  <option value="Cancelled">{t('Cancelled')}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-blue-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">#</th>
                    <th className="px-6 py-4 font-bold">{t('RequestedService', 'Requested Service')}</th>
                    <th className="px-6 py-4 font-bold">{t('Assigned Administrator')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('AdminID', 'Admin ID')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Mission')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Due Date')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('LastAction', 'Last Action')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedToOthersAppointments.length > 0 ? (
                    assignedToOthersAppointments.map((app, index) => (
                      <tr key={`users-assigned-others-${app.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{app.service}</p>
                          <p className="text-xs text-slate-500">
                            {t('User')}: {users.find(u => u.uid === app.clientId)?.displayName} • {safeFormat(app.createdAt, 'MMM d, yyyy')}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{app.assignedAdminName}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 text-center">
                          {app.assignedAdminJobId || <span className="text-slate-300 italic">N/A</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 text-center max-w-[200px]">
                          <div className="truncate" title={app.mission}>
                            {app.mission || <span className="text-slate-300 italic">N/A</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {app.dueDate ? (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                              app.status === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {safeFormat(app.dueDate, 'MMM d, h:mm a')}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">{t('NoDueDate')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusStyles(app.status)}`}>
                            {t(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]" title={getLastAction(app.audit)}>
                              {getLastAction(app.audit)}
                            </span>
                            <AuditInfo audit={app.audit} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => navigate(`/admin/users/${app.clientId}`)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <ChevronRight size={18} className="text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        {t('NoAssignments')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <p className="text-sm font-bold text-slate-700">
                {t('Total')}: {assignedToOthersAppointments.length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('ServicesAssignedToMe', 'Services Assigned to Me')}
                  <span className="ml-2 text-blue-600">({assignedAppointments.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('ServiceAssignmentsDesc')}</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text"
                  placeholder={t('SearchAssignments') || "Search assignments..."}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  value={assignmentSearchTerm}
                  onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-blue-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">#</th>
                    <th className="px-6 py-4 font-bold">{t('RequestedService', 'Requested Service')}</th>
                    <th className="px-6 py-4 font-bold">{t('AssignersName', "Assigner's Name")}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('AssignersAdminID', "Assigner's Admin ID")}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Mission')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Due Date')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('LastAction', 'Last Action')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedAppointments.length > 0 ? (
                    assignedAppointments.map((app, index) => {
                      const isDueSoon = app.dueDate && !app.missionAccomplished && (new Date(app.dueDate).getTime() - new Date().getTime()) < (48 * 60 * 60 * 1000);
                      
                      return (
                        <tr key={`users-assigned-me-${app.id}`} className={`hover:bg-slate-50 transition-colors ${isDueSoon ? 'bg-yellow-50/50' : ''}`}>
                          <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{app.service}</p>
                            <p className="text-xs text-slate-500">
                              {t('User')}: {users.find(u => u.uid === app.clientId)?.displayName} • {safeFormat(app.createdAt, 'MMM d, yyyy')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">
                              {app.assignerAdminJobId 
                                ? (users.find(u => u.adminId === app.assignerAdminJobId && u.role === 'admin')?.displayName || app.assignerAdminName || 'Unknown')
                                : (app.assignerAdminName || 'Unknown')}
                            </p>
                            {app.assignerAdminJobId && (
                              <p className="text-[10px] text-slate-500 italic mt-1">
                                ({t('AdminID', 'Admin ID')}: {app.assignerAdminJobId})
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 text-center">
                            {app.assignerAdminJobId || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 text-center max-w-[200px]">
                            <div className="flex items-center justify-center gap-2">
                              <div className="truncate" title={app.mission}>
                                {app.mission || <span className="text-slate-300 italic">N/A</span>}
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const newStatus = !app.missionAccomplished;
                                    await updateDoc(doc(db, 'appointments', app.id), {
                                      missionAccomplished: newStatus,
                                      missionAccomplishedAt: newStatus ? new Date().toISOString() : null,
                                      audit: arrayUnion(getAuditMetadata(profile, `Toggled mission status to ${newStatus ? 'Accomplished' : 'Pending'}`))
                                    });
                                    await logGlobalAudit(profile, 'Update Mission Status', 'service', `Marked mission for ${app.service} as ${newStatus ? 'Accomplished' : 'Pending'}`, app.id);
                                    toast.success(t('MissionStatusUpdated', 'Mission status updated'));
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, 'appointments');
                                  }
                                }}
                                className={`p-1 rounded-full transition-colors ${app.missionAccomplished ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-green-500 hover:bg-slate-100'}`}
                              >
                                <CheckCircle size={18} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {app.dueDate ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                app.missionAccomplished ? 'bg-green-100 text-green-700' : 
                                isDueSoon ? 'bg-yellow-200 text-yellow-800 animate-pulse' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {safeFormat(app.dueDate, 'MMM d, h:mm a')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">{t('NoDueDate')}</span>
                            )}
                          </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusStyles(app.status)}`}>
                            {t(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]" title={getLastAction(app.audit)}>
                              {getLastAction(app.audit)}
                            </span>
                            <AuditInfo audit={app.audit} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => navigate(`/admin/users/${app.clientId}`)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <ChevronRight size={18} className="text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        {t('NoAssignments')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
          <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('RegisteredAdministrators')}
              <span className="ml-2 text-blue-600">({filteredAdmins.length})</span>
            </h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('SearchAdministrators')}
                className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
              />
            </div>
          </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold w-12">#</th>
                  <th className="px-6 py-4 font-bold">{t('Administrator')}</th>
                  <th className="px-6 py-4 font-bold">{t('JobID')}</th>
                  <th className="px-6 py-4 font-bold">{t('EmailAddress')}</th>
                  <th className="px-6 py-4 font-bold">{t('OfficePhone')}</th>
                  <th className="px-6 py-4 font-bold">{t('Office', 'Office')}</th>
                  <th className="px-6 py-4 font-bold">{t('Status', 'Status')}</th>
                  <th className="px-6 py-4 font-bold text-center">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAdmins.map((admin, index) => (
                  <tr key={`dashboard-admin-${admin.uid}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                          {admin.displayName ? admin.displayName[0] : 'A'}
                        </div>
                        <div title={admin.email}>
                          <p className="font-medium text-slate-900 dark:text-white">{admin.displayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{admin.jobTitle}</p>
                          {admin.promotedByAdminId && (
                            <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium mt-1">
                              {t('Promoter')}: ({admin.promotedByAdminId})
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300 font-mono">
                      {admin.adminId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setHistoryModal({ isOpen: true, type: 'email', targetUserId: admin.uid })}
                          className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title={t('EmailHistory')}
                        >
                          <Eye size={12} />
                        </button>
                        <button 
                          onClick={() => handleEmailClick(admin)}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                        >
                          <Mail size={14} />
                        </button>
                        {admin.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setHistoryModal({ isOpen: true, type: 'call', targetUserId: admin.uid })}
                          className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title={t('CallHistory')}
                        >
                          <Eye size={12} />
                        </button>
                        <button 
                          onClick={() => handlePhoneClick(admin)}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                        >
                          <Phone size={14} />
                        </button>
                        {admin.officePhone || t('NA')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {offices.find(o => o.id === admin.officeId)?.nickName || t('NoOffice', 'No Office')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        admin.status === 'active' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      }`}>
                        {t(admin.status === 'active' ? 'Active' : 'Paused')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => navigate(`/admin/users/${admin.uid}`)}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                        title={t('ViewProfile')}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAdmins.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">
                      {t('NoAdministratorsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-8">
          <DailyServiceReport 
            appointments={appointments} 
            users={users} 
            offices={offices} 
            services={services} 
          />
        </div>
      )}

      <div className="flex justify-end mt-8">
        <div className="w-full md:w-1/2 lg:w-1/3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw size={16} className="text-blue-600" />
              {t('RestoreDeletedProfiles')}
              <span className="ml-auto text-blue-600">({deletedUsers.length})</span>
            </h2>
          </div>
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={14} />
              <input
                type="text"
                placeholder={t('SearchDeletedUsers')}
                className="w-full pl-9 pr-4 py-2 border border-blue-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={deletedUserSearchTerm}
                onChange={(e) => setDeletedUserSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
              {deletedUsers.filter(u => 
                u.displayName?.toLowerCase().includes(deletedUserSearchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(deletedUserSearchTerm.toLowerCase())
              ).length > 0 ? (
                deletedUsers.filter(u => 
                  u.displayName?.toLowerCase().includes(deletedUserSearchTerm.toLowerCase()) ||
                  u.email?.toLowerCase().includes(deletedUserSearchTerm.toLowerCase())
                ).map((u, index) => (
                  <div key={`dashboard-deleted-user-${u.id}`} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg border border-slate-50 dark:border-slate-800 transition-colors">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-blue-600 mt-0.5">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.displayName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">{t('DeletedAt')}: {safeFormat(u.deletedAt, 'MMM d, yyyy')}</p>
                        {u.deletedBy && (
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 italic">
                            ({t('AdminID')}: {u.deletedBy})
                          </p>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button 
                        onClick={() => handleRestoreUser(u)}
                        className="ml-2 p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                        title={t('RestoreUser')}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-4 italic">{t('NoDeletedUsersFound')}</p>
              )}
            </div>
          </div>
        </div>
      </div>



      {showWarning1 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-amber-100 dark:border-amber-900/30"
          >
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold dark:text-white">{t('RestrictedAreaWarning', 'Restricted Area Warning')}</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
              {t('RestrictedAreaWarningMsg1', 'Warning: You are about to enter a restricted area. This access is monitored.')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowWarning1(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={() => {
                  setShowWarning1(false);
                  setShowWarning2(true);
                }}
                className="flex-1 px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-700 dark:hover:bg-amber-800 transition-colors shadow-lg shadow-amber-200 dark:shadow-none"
              >
                {t('Continue')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showWarning2 && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30"
          >
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-full">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold dark:text-white">{t('FinalSecurityVerification', 'Final Security Verification')}</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-bold uppercase tracking-tight">
              {t('RestrictedAreaWarningMsg2', 'FINAL WARNING: Unauthorized access to this Google Drive folder is strictly prohibited. Do you wish to proceed at your own risk?')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowWarning2(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={() => {
                  setShowWarning2(false);
                  window.open(googleDriveLink, '_blank');
                }}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-xl font-bold hover:bg-red-700 dark:hover:bg-red-800 transition-colors shadow-lg shadow-red-200 dark:shadow-none"
              >
                {t('ProceedToAccess', 'Proceed to Access')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <InteractionHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
        type={historyModal.type}
        targetUserId={historyModal.targetUserId}
      />
      {/* Supervision Management removed - now a full page */}
    </div>
  );
};

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string 
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30 transition-colors duration-300"
      >
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold dark:text-white">{title}</h3>
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t('Cancel')}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-xl font-bold hover:bg-red-700 dark:hover:bg-red-800 transition-colors shadow-lg shadow-red-200 dark:shadow-none"
          >
            {t('Confirm')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ClientAppointments = ({ clientId }: { clientId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { t } = useTranslation();
  const { isAdmin, profile } = useAuth();
  const [cancellingAppId, setCancellingAppId] = useState<string | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditService = async (newName: string, newPrice: string) => {
    if (!editingApp) return;
    const updatedService = `${newName} - $${newPrice}`;
    try {
      await updateDoc(doc(db, 'appointments', editingApp.id), {
        service: updatedService,
        audit: getAuditMetadata(profile, `Edited service name/price to: ${updatedService}`)
      });
      toast.success(t('ServiceUpdatedSuccessfully'));
      setIsEditModalOpen(false);
      setEditingApp(null);
    } catch (error) {
      toast.error(t('FailedToUpdateService'));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('clientId', '==', clientId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAppointments(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));
    return unsubscribe;
  }, [clientId]);

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = 
      app.service?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.assignedAdminName && app.assignedAdminName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const updateStatus = async (id: string, status: string) => {
    const appInfo = appointments.find(a => a.id === id);
    if (profile?.role === 'admin' && appInfo?.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    if (status === 'Cancelled') {
      setCancellingAppId(id);
      setShowCancelWarning(true);
      return;
    }
    await updateDoc(doc(db, 'appointments', id), { 
      status,
      audit: getAuditMetadata(profile, `Updated appointment status to ${status}`)
    });
    toast.success(`${t('Appointment')} ${t(status)}`);
  };

  const updatePaymentStatus = async (appointment: Appointment, paymentStatus: string, partialPayments?: PartialPayment[], paymentMethod?: string) => {
    if (profile?.role === 'admin' && appointment.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    let finalStatus = paymentStatus;
    if (paymentStatus === 'PaPay' && partialPayments) {
      const totalPaid = partialPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const fee = getServiceFee(appointment.service);
      if (fee > 0 && totalPaid >= fee) {
        finalStatus = 'FullPay';
      }
    }

    const updateData: any = { 
      paymentStatus: finalStatus,
      audit: getAuditMetadata(profile, `Updated payment status to ${finalStatus}${paymentMethod ? ` with method ${paymentMethod}` : ''}`)
    };
    if (partialPayments) {
      updateData.partialPayments = partialPayments;
    }
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
    }
    await updateDoc(doc(db, 'appointments', appointment.id), updateData);
    toast.success(`${t('PaymentStatusUpdatedTo')} ${t(finalStatus)}`);
  };

  const handleRestoreAppointment = async (id: string) => {
    const appInfo = appointments.find(a => a.id === id);
    if (profile?.role === 'admin' && appInfo?.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'Process',
        createdAt: now,
        date: now,
        assignedAdminId: null,
        assignedAdminName: null,
        assignedAdminJobId: null,
        assignedBy: null,
        assignerAdminJobId: null,
        dueDate: null,
        mission: null,
        audit: getAuditMetadata(profile, 'Restored appointment')
      });
      toast.success(t('ServiceRestored') || 'Service restored successfully');
    } catch (error) {
      toast.error(t('FailedToRestoreService') || 'Failed to restore service');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={t('SearchServices') || "Search services, notes, status..."}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <select
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">{t('AllStatuses') || 'All Statuses'}</option>
            <option value="New">{t('New')}</option>
            <option value="Process">{t('Process')}</option>
            <option value="Complete">{t('Complete')}</option>
            <option value="Cancelled">{t('Cancelled')}</option>
          </select>
        </div>
      </div>

      <YellowWarningModal 
        isOpen={showCancelWarning}
        onClose={() => {
          setShowCancelWarning(false);
          setCancellingAppId(null);
        }}
        requireReason={isAdmin}
        onConfirm={async (reason) => {
          if (cancellingAppId) {
            const appToCancel = appointments.find(a => a.id === cancellingAppId);
            if (profile?.role === 'admin' && appToCancel?.clientId === profile.uid) {
              toast.error(t('AdminActionForSelfBlocked'));
              return;
            }
            try {
              await updateDoc(doc(db, 'appointments', cancellingAppId), { 
                status: 'Cancelled',
                cancellationReason: reason || null,
                audit: getAuditMetadata(profile, `Cancelled service request${reason ? `: ${reason}` : ''}`)
              });
              toast.success(t('AppointmentStatusUpdated', { status: t('Cancelled') }));
            } catch (error) {
              toast.error(t('FailedToUpdateStatus'));
            }
          }
        }}
        title={t('CancelServiceWarningTitle') || 'Cancel Requested Service?'}
        message={t('CancelServiceWarningMessage') || 'Warning: This action will cancel the service request. This cannot be undone.'}
        confirmText={t('ConfirmCancellation') || 'Confirm Cancellation'}
      />

      <EditRequestedServiceModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingApp(null);
        }}
        appointment={editingApp}
        onConfirm={handleEditService}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-blue-50 text-blue-600 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 w-10 font-bold">#</th>
              <th className="px-4 py-2 font-bold">{t('Service')}</th>
              <th className="px-4 py-2 font-bold">{t('Date')}</th>
              <th className="px-4 py-2 font-bold">{t('Status')}</th>
              <th className="px-4 py-2 font-bold">{t('Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Search className="mx-auto text-slate-300 mb-3" size={40} />
                  <p className="text-slate-500 font-medium">{t('NoResultsFound') || 'No results found'}</p>
                </td>
              </tr>
            ) : (
              filteredAppointments.map((app, index) => (
                <React.Fragment key={`client-appointment-${app.id}`}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-blue-600">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{app.service}</span>
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              setEditingApp(app);
                              setIsEditModalOpen(true);
                            }}
                            disabled={app.status === 'Complete' || (app.paymentStatus || 'no pay') === 'FullPay'}
                            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('EditService')}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                      {app.requestedByAdminId && (
                        <p className="text-[10px] text-blue-600 font-medium italic mt-0.5">
                          {t('Admin')}: ({app.requestedByAdminId})
                        </p>
                      )}
                      <AuditInfo audit={app.audit} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{safeFormat(app.date, 'PP')}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <select 
                              className={`text-[10px] font-bold uppercase px-2 py-1 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                (app.paymentStatus || 'no pay') === 'FullPay' ? 'bg-green-50 text-green-600 border-green-200' :
                                (app.paymentStatus || 'no pay') === 'PaPay' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                'bg-red-50 text-red-600 border-red-200'
                              }`}
                              value={app.paymentStatus || 'no pay'}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                if (newStatus === 'PaPay') {
                                  const initialPayments = app.partialPayments && app.partialPayments.length > 0 
                                    ? app.partialPayments 
                                    : [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                  updatePaymentStatus(app, newStatus, initialPayments, app.paymentMethod);
                                } else {
                                  updatePaymentStatus(app, newStatus, undefined, app.paymentMethod);
                                }
                              }}
                            >
                              <option value="FullPay">{t('FullPay')}</option>
                              <option value="PaPay">{t('PaPay')}</option>
                              <option value="no pay">{t('no pay')}</option>
                            </select>
                            {(app.paymentStatus === 'FullPay' || app.paymentStatus === 'PaPay') && (
                              <select 
                                required
                                className={`text-[10px] font-bold uppercase px-2 py-1 rounded border outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                  !app.paymentMethod ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'
                                }`}
                                value={app.paymentMethod || ''}
                                onChange={(e) => updatePaymentStatus(app, app.paymentStatus || 'no pay', app.partialPayments, e.target.value)}
                              >
                                <option value="">{t('Method')}</option>
                                <option value="Cash">{t('Cash')}</option>
                                <option value="Card">{t('Card')}</option>
                                <option value="BankTransfer">{t('BankTransfer')}</option>
                                <option value="Check">{t('Check')}</option>
                                <option value="Stripe">{t('Stripe')}</option>
                              </select>
                            )}
                          </div>
                        ) : (
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded inline-block ${
                            app.paymentStatus === 'FullPay' ? 'bg-green-50 text-green-600' :
                            app.paymentStatus === 'PaPay' ? 'bg-amber-50 text-amber-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {t(app.paymentStatus || 'no pay')}
                            {app.paymentMethod && ` - ${t(app.paymentMethod)}`}
                          </span>
                        )}
                        {((app.paymentStatus || 'no pay') === 'PaPay' || ((app.paymentStatus || 'no pay') === 'FullPay' && app.partialPayments && app.partialPayments.length > 0)) && (
                          <div className="flex flex-col gap-2 mt-2 border-t border-slate-100 pt-2">
                            {(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }]).map((p, pIdx) => (
                              <div key={`partial-payment-${app.id}-${pIdx}`} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {isAdmin ? (
                                    <>
                                      <input 
                                        type="text"
                                        placeholder={t('Amount')}
                                        className="text-[10px] px-2 py-1 border rounded w-24 outline-none focus:ring-1 focus:ring-blue-500"
                                        defaultValue={p.amount}
                                        onBlur={(e) => {
                                          const newPayments = [...(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }])];
                                          newPayments[pIdx].amount = e.target.value;
                                          updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                                        }}
                                      />
                                      <select 
                                        required
                                        className={`text-[10px] px-2 py-1 border rounded outline-none focus:ring-1 focus:ring-blue-500 ${
                                          !p.method ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                                        }`}
                                        value={p.method || ''}
                                        onChange={(e) => {
                                          const newPayments = [...(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }])];
                                          newPayments[pIdx].method = e.target.value;
                                          updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                                        }}
                                      >
                                        <option value="">{t('Method')}</option>
                                        <option value="Cash">{t('Cash')}</option>
                                        <option value="Card">{t('Card')}</option>
                                        <option value="BankTransfer">{t('BankTransfer')}</option>
                                        <option value="Check">{t('Check')}</option>
                                        <option value="Stripe">{t('Stripe')}</option>
                                      </select>
                                    </>
                                  ) : (
                                    p.amount && (
                                      <span className="text-[10px] font-bold text-amber-600">
                                        {p.amount} {p.method && `(${t(p.method)})`}
                                      </span>
                                    )
                                  )}
                                </div>
                                <span className="text-[9px] text-slate-500 italic">
                                  {p.date}
                                </span>
                              </div>
                            ))}
                            {isAdmin && (app.paymentStatus || 'no pay') === 'PaPay' && (
                              <button 
                                onClick={() => {
                                  const currentPayments = app.partialPayments && app.partialPayments.length > 0 
                                    ? app.partialPayments 
                                    : [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                  const newPayments = [...currentPayments, { amount: '', date: format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                  updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 mt-1"
                              >
                                <Plus size={12} /> {t('AddPayment')}
                              </button>
                            )}
                            <div className="text-[10px] font-bold text-blue-600 mt-1 border-t border-slate-100 pt-1">
                              {t('TotalPaid')}: ${ (app.partialPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2) }
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select 
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${getStatusStyles(app.status || 'Process')}`}
                          value={app.status || 'Process'}
                          onChange={(e) => updateStatus(app.id, e.target.value as any)}
                        >
                          <option value="Complete">{t('Complete')}</option>
                          <option value="Process">{t('Process')}</option>
                          {(app.status || 'Process') !== 'Complete' && (
                            <option value="Cancelled">{t('Cancelled')}</option>
                          )}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded inline-block ${getStatusStyles(app.status || 'Process')}`}>
                          {t(app.status || 'Process')}
                        </span>
                      )}
                      {app.status === 'Cancelled' && (
                        <button 
                          onClick={() => handleRestoreAppointment(app.id)}
                          className="ml-2 p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors inline-flex items-center justify-center"
                          title={t('RestoreService') || 'Restore Service'}
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {index < filteredAppointments.length - 1 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-0">
                        <div className="border-t border-blue-400 mx-4 opacity-30"></div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl">
        <p className="text-xs font-bold text-slate-700">
          {t('Total')}: {appointments.length}
        </p>
      </div>
    </div>
  );
};


const logInteraction = async (type: 'email' | 'call', targetUser: UserProfile, adminProfile: UserProfile | null) => {
  if (!adminProfile) return;
  try {
    const logId = Math.random().toString(36).substring(2, 15);
    const action = type === 'email' ? 'Sent Email' : 'Logged Phone Call';
    await logGlobalAudit(adminProfile, action, 'service', `Logged ${type} with user ${targetUser.displayName}`, targetUser.uid, targetUser.displayName);
    
    await setDoc(doc(db, 'interaction_logs', logId), {
      id: logId,
      type,
      adminUid: adminProfile.uid,
      adminJobId: adminProfile.adminId || 'N/A',
      targetUserId: targetUser.uid,
      targetUserEmail: targetUser.email,
      targetUserPhone: targetUser.phoneNumber || 'N/A',
      timestamp: new Date().toISOString(),
      audit: getAuditMetadata(adminProfile)
    });
  } catch (error) {
    console.error('Failed to log interaction:', error);
  }
};

const InteractionHistoryModal = ({ 
  isOpen, 
  onClose, 
  type, 
  targetUserId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  type: 'email' | 'call'; 
  targetUserId: string;
}) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    if (!isOpen) return;
    setLoading(true);
    const q = query(
      collection(db, 'interaction_logs'),
      where('targetUserId', '==', targetUserId),
      where('type', '==', type)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedLogs = snapshot.docs
        .map(doc => doc.data())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sortedLogs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'interaction_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, targetUserId, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {type === 'email' ? <Mail size={24} /> : <Phone size={24} />}
            {type === 'email' ? t('EmailHistory') : t('CallHistory')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-full text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 italic">{t('NoInteractions')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={`interaction-log-${log.id}`} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {t('AdminID')}: <span className="text-blue-600">{log.adminJobId}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {log.type === 'email' ? log.targetUserEmail : log.targetUserPhone}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      {safeFormat(log.timestamp, 'PPpp')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
          >
            {t('Close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface UserFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}



interface UserDocument {
  id: string;
  name: string;
  folderId: string | null;
  url: string;
  type: 'low' | 'high';
  uploadedAt: string;
}

const FolderSystem = ({ userId }: { userId: string }) => {
  const { t } = useTranslation();
  const { profile, isAdmin } = useAuth();
  const [driveLink, setDriveLink] = useState('');
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocType, setNewDocType] = useState<'low' | 'high'>('low');

  useEffect(() => {
    if (!isAdmin) return;
    const unsubUser = onSnapshot(doc(db, 'users', userId), (snap) => {
      const data = snap.data();
      if (data?.googleDriveLink) setDriveLink(data.googleDriveLink);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${userId}`));

    const unsubFolders = onSnapshot(query(collection(db, 'user_folders'), where('userId', '==', userId)), (snap) => {
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserFolder)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'user_folders'));

    const unsubDocs = onSnapshot(query(collection(db, 'user_documents'), where('userId', '==', userId)), (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDocument)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'user_documents'));

    return () => {
      unsubUser();
      unsubFolders();
      unsubDocs();
    };
  }, [userId]);

  const handleSaveLink = async () => {
    try {
      await updateDoc(doc(db, 'users', userId), { googleDriveLink: driveLink });
      toast.success(t('NoteSaved'));
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      await addDoc(collection(db, 'user_folders'), {
        userId,
        name: newFolderName,
        parentId: currentFolderId,
        createdAt: new Date().toISOString()
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      toast.success(t('FolderCreated'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'user_folders');
    }
  };

  const handleUploadDoc = async () => {
    if (!newDocName || !newDocUrl) return;
    try {
      await addDoc(collection(db, 'user_documents'), {
        userId,
        name: newDocName,
        url: newDocUrl,
        folderId: currentFolderId,
        type: newDocType,
        uploadedAt: new Date().toISOString()
      });
      setNewDocName('');
      setNewDocUrl('');
      setIsUploadingDoc(false);
      toast.success(t('DocumentUploaded'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'user_documents');
    }
  };

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentDocs = documents.filter(d => d.folderId === currentFolderId);
  const parentFolder = folders.find(f => f.id === currentFolderId);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FolderIcon className="text-blue-600" size={20} />
          {t('FolderSystem')}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCreatingFolder(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={t('CreateFolder')}
          >
            <FolderPlus size={20} />
          </button>
          <button 
            onClick={() => setIsUploadingDoc(true)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title={t('UploadDocument')}
          >
            <Upload size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input 
            type="text"
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder={t('GoogleDriveLink')}
            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSaveLink}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
          >
            {t('SaveLink')}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 italic">{t('GoogleDriveLinkNote')}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <button 
            onClick={() => setCurrentFolderId(null)}
            className={`hover:text-blue-600 ${!currentFolderId ? 'text-blue-600' : ''}`}
          >
            {t('RootFolder')}
          </button>
          {currentFolderId && (
            <>
              <ChevronRight size={14} />
              <span>{parentFolder?.name}</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentFolders.map(folder => (
            <button 
              key={`case-mgmt-folder-${folder.id}`}
              onClick={() => setCurrentFolderId(folder.id)}
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 hover:border-blue-200 transition-all group"
            >
              <FolderIcon size={32} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">{folder.name}</span>
            </button>
          ))}
          {currentDocs.map(doc => (
            <a 
              key={`case-mgmt-doc-${doc.id}`}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 hover:border-green-200 transition-all group"
            >
              <FileText size={32} className="text-green-400 group-hover:text-green-600 transition-colors" />
              <div className="flex flex-col items-center gap-0.5 w-full">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">{doc.name}</span>
                <span className={`text-[8px] uppercase font-black ${doc.type === 'high' ? 'text-orange-500' : 'text-blue-500'}`}>
                  {t(doc.type === 'high' ? 'HighVolume' : 'LowVolume')}
                </span>
              </div>
            </a>
          ))}
          {currentFolders.length === 0 && currentDocs.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs italic">
              {t('NoDocumentsInCategory')}
            </div>
          )}
        </div>
      </div>

      {isCreatingFolder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('CreateFolder')}</h3>
            <input 
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('FolderName')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsCreatingFolder(false)}
                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleCreateFolder}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
              >
                {t('Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadingDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('UploadDocument')}</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('DocumentName')}</label>
                <input 
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder={t('DocumentName')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('GoogleDriveLink')}</label>
                <input 
                  type="text"
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('DocumentType')}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setNewDocType('low')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newDocType === 'low' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                  >
                    {t('LowVolume')}
                  </button>
                  <button 
                    onClick={() => setNewDocType('high')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newDocType === 'high' ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                  >
                    {t('HighVolume')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsUploadingDoc(false)}
                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleUploadDoc}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
              >
                {t('Upload')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const handleBulletPoints = (value: string, setter: (v: string) => void) => {
  const lines = value.split('\n');
  const lastLine = lines[lines.length - 1];
  
  // If the user just pressed enter (last line is empty)
  if (value.endsWith('\n')) {
    const prevLine = lines[lines.length - 2];
    if (prevLine && prevLine.trim() && !prevLine.startsWith('• ')) {
      lines[lines.length - 2] = '• ' + prevLine;
      setter(lines.join('\n') + '• ');
      return;
    }
    if (prevLine && prevLine.startsWith('• ')) {
      setter(value + '• ');
      return;
    }
  }
  
  // Initial bullet point if empty and user starts typing
  if (value.length > 0 && !value.startsWith('• ')) {
    setter('• ' + value);
    return;
  }

  // If user deletes the bullet point, let them
  if (value === '• ') {
    setter('');
    return;
  }

  setter(value);
};

const UserDetail = () => {
  const { t } = useTranslation();
  const { userId } = useParams();
  const { profile, isAdmin, canEdit } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editTopSpecialties, setEditTopSpecialties] = useState('');
  const [editCredentials, setEditCredentials] = useState('');
  const [editYearsOfExperience, setEditYearsOfExperience] = useState('');
  const [editCalendarUrl, setEditCalendarUrl] = useState('');
  const [editLanguages, setEditLanguages] = useState('');
  const [editGoogleDriveLink, setEditGoogleDriveLink] = useState('');
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [deactivateStep, setDeactivateStep] = useState(0);
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; type: 'email' | 'call' }>({ isOpen: false, type: 'email' });

  const handleEmailClick = () => {
    if (!user?.email) return;
    logInteraction('email', user, profile);
    window.open(`mailto:${user.email}`, '_blank');
  };

  const handlePhoneClick = () => {
    if (!user?.phoneNumber) return;
    logInteraction('call', user, profile);
    window.open(`tel:${user.phoneNumber}`, '_blank');
  };
  const isTargetAdmin = user?.role === 'admin';
  
  const navigate = useNavigate();
  const isSelfAdmin = isAdmin && profile?.uid === userId;

  useEffect(() => {
    if (!isAdmin) return;
    if (!userId) return;
    
    const unsubscribeUser = onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setUser(data);
        // Update edit fields when data changes, but only if not currently editing
        setEditName(prev => isEditing ? prev : (data.displayName || ''));
        setEditPhone(prev => isEditing ? prev : (data.phoneNumber || ''));
        setEditDob(prev => isEditing ? prev : (data.dob || ''));
        setEditStreet(prev => isEditing ? prev : (data.streetAddress || ''));
        setEditCity(prev => isEditing ? prev : (data.city || ''));
        setEditState(prev => isEditing ? prev : (data.stateProvince || ''));
        setEditZip(prev => isEditing ? prev : (data.zipCode || ''));
        setEditCountry(prev => isEditing ? prev : (data.country || ''));
        setEditJobTitle(prev => isEditing ? prev : (data.jobTitle || ''));
        setEditTopSpecialties(prev => isEditing ? prev : (data.topSpecialties || ''));
        setEditCredentials(prev => isEditing ? prev : (data.credentials || ''));
        setEditYearsOfExperience(prev => isEditing ? prev : (data.yearsOfExperience || ''));
        setEditCalendarUrl(prev => isEditing ? prev : (data.calendarUrl || ''));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}`));

    const qApp = query(collection(db, 'appointments'), where('clientId', '==', userId));
    const unsubscribeApp = onSnapshot(qApp, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAppointments(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    const qReferred = query(collection(db, 'users'), where('referrerId', '==', userId));
    const unsubscribeReferred = onSnapshot(qReferred, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setReferredUsers(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users/referred'));

    return () => {
      unsubscribeUser();
      unsubscribeApp();
      unsubscribeReferred();
    };
  }, [userId, isEditing]);

  const handleUpdateUser = async () => {
    if (!userId || !user) return;
    try {
      const updateData: any = {
        displayName: isSelfAdmin ? user.displayName : editName,
        phoneNumber: isSelfAdmin ? user.phoneNumber : editPhone,
        dob: isSelfAdmin ? user.dob : editDob,
        streetAddress: isSelfAdmin ? user.streetAddress : editStreet,
        city: isSelfAdmin ? user.city : editCity,
        stateProvince: isSelfAdmin ? user.stateProvince : editState,
        zipCode: isSelfAdmin ? user.zipCode : editZip,
        country: isSelfAdmin ? user.country : editCountry,
        jobTitle: editJobTitle,
        topSpecialties: editTopSpecialties,
        credentials: editCredentials,
        yearsOfExperience: editYearsOfExperience,
        calendarUrl: editCalendarUrl,
        languages: editLanguages,
        updatedBy: profile?.adminId || null,
        updatedAt: new Date().toISOString(),
        audit: arrayUnion(getAuditMetadata(profile, 'Updated user profile details'))
      };

      await updateDoc(doc(db, 'users', userId), updateData);
      
      const action = isSelfAdmin ? 'Update Own Profile' : 'Update Client Profile';
      await logGlobalAudit(profile, action, 'profile', `Updated profile information for ${user.displayName}`, userId, user.displayName);

      setUser(prev => prev ? { 
        ...prev, 
        ...updateData
      } : null);
      setIsEditing(false);
      toast.success(t('UserUpdated'));
    } catch (error) {
      toast.error(t('UpdateFailed'));
    }
  };

  const toggleBlockUser = async () => {
    if (!user || !userId) return;
    if (user.role === 'admin') {
      toast.error(t('CannotBlockAdmin'));
      return;
    }
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await updateDoc(doc(db, 'users', userId), { 
      status: newStatus,
      statusChangedBy: profile?.adminId || null,
      statusChangedAt: new Date().toISOString(),
      audit: arrayUnion(getAuditMetadata(profile, `Changed user status to ${newStatus}`))
    });
    await logGlobalAudit(profile, newStatus === 'blocked' ? 'Block Profile' : 'Unblock Profile', 'profile', `${newStatus === 'blocked' ? 'Blocked' : 'Unblocked'} account for ${user.displayName}`, userId, user.displayName);
    setUser({ ...user, status: newStatus, statusChangedBy: profile?.adminId || null });
    toast.success(newStatus === 'blocked' ? t('UserBlocked') : t('UserUnblocked'));
  };

  const togglePortalAccess = async () => {
    if (!user || !userId) return;
    
    if (user.role === 'admin') {
      toast.error(t('CannotBlockAdmin'));
      return;
    }

    if (deactivateStep < 2) {
      setDeactivateStep(prev => prev + 1);
      return;
    }

    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'users', userId), { 
        status: newStatus,
        statusChangedBy: profile?.uid || null,
        statusChangedAt: new Date().toISOString(),
        audit: arrayUnion(getAuditMetadata(profile, `Changed portal access status to ${newStatus}`))
      });
      await logGlobalAudit(profile, newStatus === 'blocked' ? 'Portal Access Blocked' : 'Portal Access Granted', 'profile', `${newStatus === 'blocked' ? 'Deactivated' : 'Activated'} portal access for ${user.displayName}`, userId, user.displayName);
      setUser({ ...user, status: newStatus });
      setDeactivateStep(0);
      toast.success(newStatus === 'blocked' ? t('UserBlocked') : t('UserUnblocked'));
    } catch (error) {
      toast.error(t('UpdateFailed'));
    }
  };

  const handleDeleteUser = async () => {
    if (!userId || !user) return;
    
    if (user.role === 'admin') {
      toast.error(t('CannotDeleteAdmin'));
      return;
    }

    if (deleteConfirmationStep < 2) {
      setDeleteConfirmationStep(prev => prev + 1);
      return;
    }

    try {
      // Soft delete: move to deleted_users collection
      await setDoc(doc(db, 'deleted_users', userId), {
        uid: userId,
        email: user.email,
        displayName: user.displayName,
        deletedAt: new Date().toISOString(),
        deletedBy: profile?.adminId || null,
        originalData: user,
        audit: getAuditMetadata(profile, 'Deleted user profile')
      });
      
      // Delete from Auth via backend
      try {
        await fetch('/api/admin/delete-user-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: userId })
        });
      } catch (authError) {
        console.error('Failed to delete from Auth:', authError);
      }

      // Remove from users collection
      await deleteDoc(doc(db, 'users', userId));
      
      await logGlobalAudit(profile, 'Delete User Profile', 'profile', `Permanently deleted user profile for ${user.displayName}`, userId, user.displayName);

      toast.success(t('UserDeleted'));
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(t('FailedToDeleteUser'));
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen">{t('Loading')}</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-3xl font-bold text-slate-900">{t('UsersProfile', { name: user.displayName })}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {user.role === 'employee' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Shield className={user.status === 'active' ? 'text-emerald-600' : 'text-red-600'} size={20} />
                    {user.status === 'active' ? t('PortalActive') : t('PortalDeactivated')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {user.status === 'active' ? t('PortalActiveDesc') : t('PortalDeactivatedDesc')}
                  </p>
                </div>
                <button
                  onClick={togglePortalAccess}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    user.status === 'active' 
                      ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200' 
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {user.status === 'active' ? t('DeactivatePortal') : t('ReactivatePortal')}
                </button>
              </div>

              {deactivateStep > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-amber-800">
                        {user.status === 'active' 
                          ? (deactivateStep === 1 ? t('DeactivateWarning1') : t('DeactivateWarning2'))
                          : (deactivateStep === 1 ? t('ReactivateWarning1') : t('ReactivateWarning2'))
                        }
                      </p>
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={togglePortalAccess}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all"
                        >
                          {t('Confirm')}
                        </button>
                        <button
                          onClick={() => setDeactivateStep(0)}
                          className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-50 transition-all"
                        >
                          {t('Cancel')}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {user.referrerName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-center gap-3">
              <Users className="text-blue-600 dark:text-blue-400" size={20} />
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                {t('ReferredBy', { name: user.referrerName })}
              </p>
            </div>
          )}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{t('UserInfo')}</h2>
                <AuditInfo audit={user.audit} />
              </div>
              <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:underline text-sm">{t('Edit')}</button>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('DisplayName')}</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSelfAdmin}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('PhoneNumber')}</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={isSelfAdmin}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('DateOfBirth')}</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    disabled={isSelfAdmin}
                  />
                </div>
                {user.role === 'admin' && user.adminId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('AdminID')}</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 text-slate-500 font-mono"
                      value={user.adminId}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('StreetAddress')}</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                    value={editStreet}
                    onChange={(e) => setEditStreet(e.target.value)}
                    disabled={isSelfAdmin}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('City')}</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      disabled={isSelfAdmin}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('StateProvince')}</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      disabled={isSelfAdmin}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('ZipCode')}</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                      value={editZip}
                      onChange={(e) => setEditZip(e.target.value)}
                      disabled={isSelfAdmin}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('Country')}</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white disabled:bg-slate-50 disabled:text-slate-500"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      disabled={isSelfAdmin}
                    />
                  </div>
                </div>

                {user.role === 'admin' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('JobTitle')}</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('TopSpecialties')}</label>
                      <textarea 
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                        value={editTopSpecialties}
                        onChange={(e) => handleBulletPoints(e.target.value, setEditTopSpecialties)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('Credentials')}</label>
                      <textarea 
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                        value={editCredentials}
                        onChange={(e) => handleBulletPoints(e.target.value, setEditCredentials)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('YearsOfExperience')}</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        value={editYearsOfExperience}
                        onChange={(e) => setEditYearsOfExperience(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('CalendarLink')}</label>
                      <input 
                        type="url" 
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="https://calendar.google.com/..."
                        value={editCalendarUrl}
                        onChange={(e) => setEditCalendarUrl(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('GoogleDriveFolderLink')}</label>
                      <input 
                        type="url" 
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={editGoogleDriveLink}
                        onChange={(e) => setEditGoogleDriveLink(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={handleUpdateUser} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">{t('Save')}</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-200 py-2 rounded-lg text-sm">{t('Cancel')}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    user.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {t(user.status)}
                  </span>
                  {user.statusChangedBy && (
                    <span className="text-[10px] text-slate-500 italic">
                      ({t('AdminID')}: {user.statusChangedBy})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 group">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setHistoryModal({ isOpen: true, type: 'email' })}
                      className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                      title={t('EmailHistory')}
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={handleEmailClick}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    >
                      <Mail size={18} />
                    </button>
                  </div>
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 group">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setHistoryModal({ isOpen: true, type: 'call' })}
                      className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                      title={t('CallHistory')}
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={handlePhoneClick}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    >
                      <Phone size={18} />
                    </button>
                  </div>
                  <span className="text-sm">{user.phoneNumber || t('NotProvided')}</span>
                </div>

                {user.role === 'admin' && (
                  <>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <Briefcase size={18} className="text-blue-600" />
                      <span className="text-sm">{user.jobTitle || t('NotProvided')}</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                      <Award size={18} className="mt-0.5 text-blue-600" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('TopSpecialties')}</span>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {user.topSpecialties || t('NotProvided')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                      <Award size={18} className="mt-0.5 text-blue-600" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('Credentials')}</span>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {user.credentials || t('NotProvided')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <Clock size={18} className="text-blue-600" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('YearsOfExperience')}</span>
                        <span className="text-sm">{user.yearsOfExperience || t('NotProvided')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <Globe size={18} className="text-blue-600" />
                      {user.calendarUrl ? (
                        <a 
                          href={user.calendarUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {user.calendarUrl}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-sm">{t('NotProvided')}</span>
                      )}
                    </div>
                  </>
                )}

                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Cake size={18} className="text-blue-600" />
                  <span className="text-sm">{user.dob ? safeFormat(user.dob + 'T00:00:00', 'PP') : t('NotProvided')}</span>
                </div>
                {user.adminId && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Shield size={18} className="text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t('AdminID')}</span>
                      <span className="text-sm font-mono">{user.adminId}</span>
                    </div>
                  </div>
                )}
                {user.officeIdNumber && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Hash size={18} className="text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t('OfficeIDNumber')}</span>
                      <span className="text-sm font-mono">{user.officeIdNumber}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin size={18} className="text-blue-600" />
                  <div className="flex flex-col">
                    <span className="text-sm">{user.streetAddress || t('NotProvided')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {[user.city, user.stateProvince, user.zipCode].filter(Boolean).join(', ')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{user.country}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Clock size={18} className="text-blue-600" />
                  <div className="flex flex-col">
                    <span className="text-sm">{t('JoinedOn', { date: safeFormat(user.createdAt, 'PPpp') })}</span>
                    {user.updatedBy && (
                      <span className="text-[10px] text-slate-400 italic">
                        ({t('AdminID')}: {user.updatedBy})
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <CommunicationOptions targetUser={user} />
                  <FlagSystem targetUser={user} onUpdate={(updated) => setUser(updated)} />
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  {canEdit && !isTargetAdmin && (
                    <button 
                      onClick={toggleBlockUser}
                      className={`w-full py-2 px-2 rounded-lg font-medium transition-colors whitespace-normal text-center leading-tight min-h-[2.5rem] text-sm ${
                        user.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {user.status === 'active' ? t('BlockUser') : t('UnblockUser')}
                    </button>
                  )}

                  {isAdmin && !isTargetAdmin && (
                    <button 
                      onClick={handleDeleteUser}
                      className={`w-full py-2 px-2 rounded-lg font-bold transition-all duration-300 whitespace-normal text-center leading-tight min-h-[2.5rem] text-sm ${
                        deleteConfirmationStep === 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' :
                        deleteConfirmationStep === 1 ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' :
                        'bg-red-700 text-white hover:bg-red-800 ring-4 ring-red-200'
                      }`}
                    >
                      {deleteConfirmationStep === 0 && t('DeleteUserProfile')}
                      {deleteConfirmationStep === 1 && t('WarningAreYouSure')}
                      {deleteConfirmationStep === 2 && t('FinalWarning')}
                    </button>
                  )}
                  
                  {isAdmin && !isTargetAdmin && deleteConfirmationStep > 0 && (
                    <button 
                      onClick={() => setDeleteConfirmationStep(0)}
                      className="text-xs text-slate-400 hover:text-slate-600 underline text-center"
                    >
                      {t('CancelDeletion')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4">{t('ServiceRequests')}</h2>
            <div className="mb-6 pb-6 border-b border-slate-100">
              <ServiceRequest clientId={userId} />
            </div>
            <div className="space-y-3">
              {appointments.filter(a => a.status === 'Process').length === 0 ? (
                <p className="text-sm text-slate-500 italic">{t('NoPendingRequests')}</p>
              ) : (
                appointments.filter(a => a.status === 'Process').map(app => (
                  <div key={`user-details-pending-${app.id}`} className="p-3 bg-blue-50 border-2 border-blue-100 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h3 className="text-sm font-bold text-blue-900">{app.service}</h3>
                        {app.requestedByAdminId && (
                          <p className="text-[10px] text-blue-600 font-medium italic">
                            {t('RequestedBy')}: ({app.requestedByAdminId})
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">{t('Pending')}</span>
                    </div>
                    <p className="text-xs text-blue-700 mb-2">{app.notes}</p>
                    <div className="flex justify-between items-center text-[10px] text-blue-600">
                      <span>{safeFormat(app.createdAt, 'PPp')}</span>
                      <button 
                        onClick={() => navigate('/admin/calendar')}
                        className="hover:underline font-bold"
                      >
                        {t('ManageInCalendar')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <RequestServiceBlock clientId={userId!} />
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <h2 className="text-lg font-bold mb-4">{t('RequestedServicesHistory')}</h2>
            <ClientAppointments clientId={userId!} />
          </div>




          <div className="overflow-hidden">
            <ReferralTrackingList userId={userId!} />
          </div>
        </div>
      </div>

      <InteractionHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
        type={historyModal.type}
        targetUserId={userId!}
      />
    </div>
  );
};

const Profile = () => {
  const { t } = useTranslation();
  const { profile, user, isAdmin, userTypeLabel } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editPhone, setEditPhone] = useState(profile?.phoneNumber || '');
  const [editDob, setEditDob] = useState(profile?.dob || '');
  const [editEmail, setEditEmail] = useState(profile?.email || '');
  const [editStreet, setEditStreet] = useState(profile?.streetAddress || '');
  const [editCity, setEditCity] = useState(profile?.city || '');
  const [editState, setEditState] = useState(profile?.stateProvince || '');
  const [editZip, setEditZip] = useState(profile?.zipCode || '');
  const [editCountry, setEditCountry] = useState(profile?.country || '');
  const [editJobTitle, setEditJobTitle] = useState(profile?.jobTitle || '');
  const [editTopSpecialties, setEditTopSpecialties] = useState(profile?.topSpecialties || '');
  const [editCredentials, setEditCredentials] = useState(profile?.credentials || '');
  const [editYearsOfExperience, setEditYearsOfExperience] = useState(profile?.yearsOfExperience || '');
  const [editCalendarUrl, setEditCalendarUrl] = useState(profile?.calendarUrl || '');
  const [editLanguages, setEditLanguages] = useState(profile?.languages || '');
  const [editGoogleDriveLink, setEditGoogleDriveLink] = useState(profile?.googleDriveFolderLink || '');
  const [editPhotoURL, setEditPhotoURL] = useState(profile?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || '');
      setEditPhone(profile.phoneNumber || '');
      setEditDob(profile.dob || '');
      setEditEmail(profile.email || '');
      setEditStreet(profile.streetAddress || '');
      setEditCity(profile.city || '');
      setEditState(profile.stateProvince || '');
      setEditZip(profile.zipCode || '');
      setEditCountry(profile.country || '');
      setEditJobTitle(profile.jobTitle || '');
      setEditTopSpecialties(profile.topSpecialties || '');
      setEditCredentials(profile.credentials || '');
      setEditYearsOfExperience(profile.yearsOfExperience || '');
      setEditCalendarUrl(profile.calendarUrl || '');
      setEditLanguages(profile.languages || '');
      setEditGoogleDriveLink(profile.googleDriveFolderLink || '');
      setEditPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // Limit to 500KB for base64 storage
      toast.error(t('FileTooLarge'));
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditPhotoURL(reader.result as string);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      if (editEmail !== profile.email && user) {
        try {
          await updateEmail(user, editEmail);
        } catch (emailError: any) {
          if (emailError.code === 'auth/requires-recent-login') {
            toast.error(t('RecentLoginRequired'));
            setLoading(false);
            return;
          }
          throw emailError;
        }
      }
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: editName,
        phoneNumber: editPhone,
        dob: editDob,
        email: editEmail,
        streetAddress: editStreet,
        city: editCity,
        stateProvince: editState,
        zipCode: editZip,
        country: editCountry,
        jobTitle: editJobTitle,
        topSpecialties: editTopSpecialties,
        credentials: editCredentials,
        yearsOfExperience: editYearsOfExperience,
        calendarUrl: editCalendarUrl,
        languages: editLanguages,
        googleDriveFolderLink: editGoogleDriveLink,
        photoURL: editPhotoURL
      });
      toast.success(t('ProfileUpdated'));
      setIsEditing(false);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    try {
      await sendPasswordResetEmail(auth, profile.email);
      toast.success(t('PasswordResetSent', { email: profile.email }));
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error, t));
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword) return;
    
    if (newPassword !== confirmPassword) {
      toast.error(t('PasswordsDoNotMatch') || 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(user, newPassword);
      toast.success(t('PasswordUpdated'));
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast.error(t('RecentLoginRequired'));
      } else {
        toast.error(getFriendlyErrorMessage(error, t));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-3xl font-bold text-slate-900">{t('MyProfile')}</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors"
        >
          {isEditing ? <X size={18} /> : <Edit2 size={18} />}
          {isEditing ? t('Cancel') : t('EditProfile')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{t('UserInfo')}</h2>
                <AuditInfo audit={profile.audit} />
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-blue-500">
                      {editPhotoURL ? (
                        <img src={editPhotoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <UserIcon size={40} />
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <Camera size={20} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500">{t('ClickToUpload')}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('FullName')}</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('EmailAddress')}</label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('PhoneNumber')}</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('DateOfBirth')}</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('StreetAddress')}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    value={editStreet}
                    onChange={(e) => setEditStreet(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('City')}</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('StateProvince')}</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('ZipCode')}</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={editZip}
                      onChange={(e) => setEditZip(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('Country')}</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                    />
                  </div>
                </div>

                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('JobTitle')}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('TopSpecialties')}</label>
                      <textarea
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                        value={editTopSpecialties}
                        onChange={(e) => handleBulletPoints(e.target.value, setEditTopSpecialties)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('Credentials')}</label>
                      <textarea
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                        value={editCredentials}
                        onChange={(e) => handleBulletPoints(e.target.value, setEditCredentials)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('YearsOfExperience')}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        value={editYearsOfExperience}
                        onChange={(e) => setEditYearsOfExperience(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('CalendarLink')}</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="https://calendar.google.com/..."
                        value={editCalendarUrl}
                        onChange={(e) => setEditCalendarUrl(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('Languages')}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="e.g. English, Spanish"
                        value={editLanguages}
                        onChange={(e) => setEditLanguages(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? t('Saving') : t('Save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-300"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 mb-6">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-blue-500 shadow-sm">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <UserIcon size={40} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900">{profile.displayName}</h3>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-xs text-slate-500 capitalize">{t(profile.role || 'client')}</p>
                      {userTypeLabel && (
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {userTypeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    profile.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {t(profile.status || 'active')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <UserIcon size={18} />
                  <span className="text-sm font-medium">{profile.displayName}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Mail size={18} />
                  <span className="text-sm">{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Phone size={18} />
                  <span className="text-sm">{profile.phoneNumber || t('NotProvided')}</span>
                </div>

                {isAdmin && (
                  <>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <Briefcase size={18} />
                      <span className="text-sm">{profile.jobTitle || t('NotProvided')}</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                      <Award size={18} className="mt-0.5" />
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.topSpecialties || t('NotProvided')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <Globe size={18} />
                      {profile.calendarUrl ? (
                        <a 
                          href={profile.calendarUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {profile.calendarUrl}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-sm">{t('NotProvided')}</span>
                      )}
                    </div>
                  </>
                )}

                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Cake size={18} />
                  <span className="text-sm">{profile.dob ? safeFormat(profile.dob + 'T00:00:00', 'PP') : t('NotProvided')}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin size={18} />
                  <div className="flex flex-col">
                    <span className="text-sm">{profile.streetAddress || t('NotProvided')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {[profile.city, profile.stateProvince, profile.zipCode].filter(Boolean).join(', ')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{profile.country}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Clock size={18} />
                  <span className="text-sm">{t('JoinedOn', { date: safeFormat(profile.createdAt, 'PPpp') })}</span>
                </div>

                {profile.referrerName && (
                  <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-800/50 rounded-xl flex items-center gap-2">
                    <Users size={14} className="text-blue-600" />
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                      {t('ReferredBy', { name: profile.referrerName })}
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-2">
                      <Lock size={16} className="text-blue-600 dark:text-blue-400" />
                      <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">{t('AccountSecurity')}</h4>
                    </div>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 mb-3">{t('AccountSecurityDesc', { email: profile.email })}</p>
                    
                    {profile.role === 'employee' ? (
                      <div className="space-y-3">
                        {!isChangingPassword ? (
                          <button
                            onClick={() => setIsChangingPassword(true)}
                            className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all"
                          >
                            {t('ChangePassword')}
                          </button>
                        ) : (
                          <form onSubmit={handleUpdatePassword} className="space-y-3" autoComplete="off">
                            <input
                              type="password"
                              required
                              minLength={6}
                              autoComplete="new-password"
                              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={t('NewPassword')}
                            />
                            <input
                              type="password"
                              required
                              minLength={6}
                              autoComplete="new-password"
                              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder={t('ConfirmPassword') || "Confirm Password"}
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                {loading ? t('Saving') : t('UpdatePassword')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsChangingPassword(false)}
                                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all"
                              >
                                {t('Cancel')}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleResetPassword}
                        className="w-full py-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                      >
                        {t('ResetPassword')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <RequestServiceBlock clientId={profile.uid} />

          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-100">
            <h2 className="text-lg font-bold mb-4">{t('RequestedServicesHistory')}</h2>
            <ClientAppointments clientId={profile.uid} />
          </div>



          <CommunicationOptions targetUser={profile} />
          <ReferralTrackingList userId={profile.uid} />
        </div>
      </div>
    </div>
  );
};






// --- Client Pages ---

const ClientPortal = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  if (!profile) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-slate-900">{t('Welcome')}</h1>
        <p className="text-sm md:text-base text-slate-500">{t('WelcomeDesc')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3">
          <RequestServiceBlock />
        </div>
        <div className="flex-1 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-100">
            <h2 className="text-lg font-bold mb-4">{t('RequestedServicesHistory')}</h2>
            <ClientAppointments clientId={profile.uid} />
          </div>

          <CommunicationOptions targetUser={profile} />
          <ReferralTrackingList userId={profile.uid} />
        </div>
      </div>
      <ChatSystem />
    </div>
  );
};

const ServiceDisplayCard = ({ service, children, className = "" }: { service: Service, children?: React.ReactNode, className?: string }) => {
  const { t } = useTranslation();
  
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'business':
        return 'bg-purple-600/80';
      case 'workshop':
        return 'bg-blue-600/80';
      default:
        return 'bg-green-600/80';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'business':
        return t('Business');
      case 'workshop':
        return t('MasterClassesWorkshop');
      default:
        return t('Individual');
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 border-blue-100 hover:shadow-md transition-all duration-300 relative group overflow-hidden flex flex-col h-full ${className}`}>
      {service.imageUrl && (
        <div className="h-24 md:h-48 w-full relative overflow-hidden">
          <img 
            src={service.imageUrl} 
            alt={service.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
            <span className={`text-white text-[10px] font-bold px-2 py-1 ${getTypeStyles(service.type)} backdrop-blur-sm rounded uppercase tracking-wider`}>
              {getTypeName(service.type)}
            </span>
          </div>
        </div>
      )}
      <div className={`p-3 md:p-6 flex-1 flex flex-col items-center text-center`}>
        <div className="flex flex-col mb-2 md:mb-3">
          <h3 className="text-sm md:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors break-words line-clamp-2">{service.name}</h3>
          <div className="mt-1">
            <AuditInfo audit={service.audit} />
          </div>
          {service.price >= 0 && (
            <div className="mt-1 md:mt-2">
              <span className="text-blue-600 font-bold text-[10px] md:text-sm bg-blue-50 px-1.5 py-0.5 rounded">
                {!service.price || service.price === 0 ? 'Fee is to be determined.' : '$' + service.price}
              </span>
            </div>
          )}
        </div>
        <p className="text-slate-500 text-[10px] md:text-sm leading-relaxed mb-3 md:mb-4 line-clamp-2 md:line-clamp-3 flex-1">
          {service.description}
        </p>
        {children}
      </div>
    </div>
  );
};

const ServicesManagement = () => {
  console.log('ServicesManagement rendering');
  const { profile, canEdit, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addingType, setAddingType] = useState<'individual' | 'business' | 'workshop'>('individual');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [serviceImageUrl, setServiceImageUrl] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editServiceImageUrl, setEditServiceImageUrl] = useState('');
  const [editPaymentLink, setEditPaymentLink] = useState('');
  const [editFormUrl, setEditFormUrl] = useState('');
  const [editType, setEditType] = useState<'individual' | 'business' | 'workshop'>('individual');
  const [individualSearch, setIndividualSearch] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [clipboard, setClipboard] = useState<Partial<Service> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!isAdmin) return;
    console.log('ServicesManagement useEffect running');
    if (!db) {
      console.error('db is undefined');
      toast.error('Firebase not initialized');
      return;
    }
    const q = query(collection(db, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('ServicesManagement snapshot received', snapshot.docs.length);
      const servicesData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Service doc data:', doc.id, data);
        return { id: doc.id, ...data } as Service;
      });
      setServices(servicesData);

      // Seed default services if none exist or if we need to sync images
      if (snapshot.docs.length < 5) {
        seedDefaultServices(servicesData);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'services');
    });
    return unsubscribe;
  }, [isAdmin]);

  const seedDefaultServices = async (currentServices?: Service[]) => {
    const servicesToUse = currentServices || services;
    const individualDefaults = [
      { name: 'Document Translation', description: 'Break language barriers with precision. Our certified translators ensure your documents maintain their original meaning and legal validity across borders.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80' },
      { name: 'Simultaneous Interpretation', description: 'Real-time clarity for your global conversations. Expert interpreters providing seamless communication for meetings, legal proceedings, and personal appointments.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80' },
      { name: 'Personal Tax Filing', description: 'Maximize your returns and minimize stress. Our tax experts navigate complex regulations to ensure accurate, timely, and optimized personal filings.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80' },
      { name: 'Tax Resolution Services', description: 'Resolve IRS disputes with confidence. We provide professional representation and strategic solutions to settle outstanding tax issues and penalties.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80' },
      { name: 'Career Transition Coaching', description: 'Navigate your next big move. Expert guidance on identifying opportunities, optimizing your professional brand, and securing your ideal role.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80' },
      { name: 'Executive Resume Branding', description: 'Stand out in a competitive market. We craft high-impact resumes and LinkedIn profiles that highlight your unique value proposition to top employers.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=800&q=80' },
      { name: 'Life Purpose Coaching', description: 'Unlock your full potential. Transformative sessions designed to help you discover your passion, set meaningful goals, and achieve lasting personal fulfillment.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80' },
      { name: 'Academic Success Tutoring', description: 'Empower your educational journey. Personalized tutoring across all subjects to build confidence, master complex concepts, and achieve academic excellence.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80' },
      { name: 'College Admissions Consulting', description: 'Secure your future at your dream institution. Strategic advice on applications, essays, and selection processes to maximize your acceptance chances.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80' },
      { name: 'Relationship & Family Counseling', description: 'Build stronger, healthier connections. Professional support in navigating conflict, improving communication, and fostering deep, meaningful relationships with loved ones.', price: 0, type: 'individual', imageUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80' },
    ];

    const businessDefaults = [
      { name: 'Entity Formation & Registration', description: 'Lay a solid foundation for your venture. Expert assistance in selecting and registering the ideal US business structure for liability protection and tax efficiency.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80' },
      { name: 'Strategic Business Financing', description: 'Fuel your growth with smart capital. We develop comprehensive financing strategies, from debt restructuring to securing venture capital and private investment.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=800&q=80' },
      { name: 'Operational System Creation', description: 'Streamline your path to success. We design and implement robust business systems that automate workflows, reduce errors, and increase overall productivity.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' },
      { name: 'Custom Software Architecture', description: 'Software built for your unique needs. Our developers design scalable, high-performance applications that solve your specific business challenges and drive innovation.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80' },
      { name: 'Enterprise Client Portals', description: 'Enhance client engagement and transparency. Secure, branded portals that allow your customers to manage projects, access documents, and communicate seamlessly with your team.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ffea9e778?auto=format&fit=crop&w=800&q=80' },
      { name: 'High-Conversion Web Design', description: 'Your digital storefront, optimized for results. We create stunning, responsive websites that capture attention and turn visitors into loyal, paying customers.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=800&q=80' },
      { name: 'Omni-Channel Marketing Strategy', description: 'Dominate your market across all platforms. Data-driven marketing campaigns that increase brand awareness, generate high-quality leads, and maximize your return on investment.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=800&q=80' },
      { name: 'SOP Development & Documentation', description: 'Ensure consistency and scalability. We document your Standard Operating Procedures to preserve institutional knowledge and empower your team to deliver excellence every time.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80' },
      { name: 'Corporate Tax Preparation', description: 'Stay compliant and keep more of your revenue. Meticulous tax preparation services that identify every eligible deduction and credit for your business.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80' },
      { name: 'Strategic Tax Planning', description: 'Proactive solutions for long-term savings. We analyze your business operations to implement tax-efficient strategies that protect your bottom line year-round.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80' },
      { name: 'Business Process Automation', description: 'Work smarter, not harder. We identify and automate repetitive tasks, freeing your team to focus on high-value strategic initiatives and growth.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80' },
      { name: 'Brand Identity & Logo Design', description: 'Make a lasting first impression. We create memorable brand identities that communicate your values and resonate deeply with your target audience.', price: 0, type: 'business', imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80' },
    ];

    const allDefaults = [...individualDefaults, ...businessDefaults];
    let addedCount = 0;
    let updatedCount = 0;
    for (const s of allDefaults) {
      const existing = servicesToUse.find(existing => existing.name === s.name && existing.type === s.type);
      if (!existing) {
        await addDoc(collection(db, 'services'), { 
          ...s,
          performedBy: 'System'
        });
        addedCount++;
      } else if (!existing.imageUrl && s.imageUrl) {
        // Update existing service with image if it's missing
        await updateDoc(doc(db, 'services', existing.id), {
          imageUrl: s.imageUrl
        });
        updatedCount++;
      }
    }
    if (addedCount > 0 || updatedCount > 0) {
      toast.success(`${addedCount} services added, ${updatedCount} services updated with professional imagery`);
    } else {
      toast.info('All professional services are up to date');
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error(t('NameRequired', 'Service name is required'));
      return;
    }
    const audit = getAuditMetadata(profile, 'Added new service');
    await addDoc(collection(db, 'services'), { 
      name: name.trim(), 
      description: desc.trim(), 
      price: Number(price) || 0,
      type: addingType,
      imageUrl: serviceImageUrl.trim(),
      paymentLink: paymentLink.trim(),
      formUrl: formUrl.trim(),
      performedBy: profile?.adminId || null,
      audit
    });
    setName(''); setDesc(''); setPrice(''); setServiceImageUrl(''); setPaymentLink(''); setFormUrl(''); setIsAdding(false);
    toast.success(t('ServiceAdded', 'Service added successfully'));
  };

  const handleDelete = async (id: string) => {
    try {
      if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        setDeleteConfirmStep(1);
        return;
      }

      if (deleteConfirmStep === 1) {
        setDeleteConfirmStep(2);
        return;
      }

      const serviceToDelete = services.find(s => s.id === id);
      if (serviceToDelete) {
        await setDoc(doc(db, 'deleted_services', id), {
          ...serviceToDelete,
          deletedAt: new Date().toISOString(),
          deletedBy: profile?.adminId || null
        });
      }
      await deleteDoc(doc(db, 'services', id));
      setDeleteConfirmId(null);
      setDeleteConfirmStep(0);
      toast.success('Service removed');
    } catch (err) {
      console.error('Error deleting service:', err);
      handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error(t('NameRequired', 'Service name is required'));
      return;
    }
    const audit = getAuditMetadata(profile, 'Updated service details');
    await updateDoc(doc(db, 'services', id), { 
      name: editName.trim(), 
      description: editDesc.trim(), 
      price: Number(editPrice) || 0,
      type: editType,
      imageUrl: editServiceImageUrl.trim(),
      paymentLink: editPaymentLink.trim(),
      formUrl: editFormUrl.trim(),
      performedBy: profile?.adminId || null,
      audit
    });
    setEditingId(null);
    toast.success(t('ServiceUpdated', 'Service updated successfully'));
  };

  const startEditing = (service: Service) => {
    setEditingId(service.id);
    setEditName(service.name || '');
    setEditDesc(service.description || '');
    setEditPrice((service.price || 0).toString());
    setEditServiceImageUrl(service.imageUrl || '');
    setEditPaymentLink(service.paymentLink || '');
    setEditFormUrl(service.formUrl || '');
    setEditType(service.type || 'individual');
  };

  const handleCopy = (service: Service) => {
    const { id, ...rest } = service;
    setClipboard(rest);
    toast.success(t('Copied'));
  };

  const handlePaste = async (type: 'individual' | 'business' | 'workshop') => {
    if (!clipboard) return;
    const audit = getAuditMetadata(profile, 'Pasted service from clipboard');
    await addDoc(collection(db, 'services'), {
      ...clipboard,
      type,
      performedBy: profile?.adminId || null,
      audit
    });
    toast.success(t('Service pasted'));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped over a container or another item
    const activeService = services.find(s => s.id === activeId);
    if (!activeService) return;

    let newType: 'individual' | 'business' | 'workshop' | null = null;
    if (overId === 'individual-container') {
      newType = 'individual';
    } else if (overId === 'business-container') {
      newType = 'business';
    } else if (overId === 'workshop-container') {
      newType = 'workshop';
    } else {
      // Dropped over another item
      const overService = services.find(s => s.id === overId);
      if (overService && overService.type !== activeService.type) {
        newType = overService.type;
      }
    }

    if (newType && newType !== activeService.type) {
      await updateDoc(doc(db, 'services', activeId), { type: newType });
      toast.success(`Service moved to ${newType === 'business' ? t('Business') : newType === 'workshop' ? t('MasterClassesWorkshop') : t('Individual')}`);
    }
  };

  const filteredIndividualServices = services
    .filter(s => 
      (s.type === 'individual' || !s.type) && 
      (s.name.toLowerCase().includes(individualSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(individualSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredBusinessServices = services
    .filter(s => 
      s.type === 'business' && 
      (s.name.toLowerCase().includes(businessSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(businessSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredWorkshopServices = services
    .filter(s => 
      s.type === 'workshop' && 
      (s.name.toLowerCase().includes(workshopSearch.toLowerCase()) || 
       s.description.toLowerCase().includes(workshopSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const ServiceCard = ({ service, isOverlay = false }: { service: Service, isOverlay?: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: service.id });

    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className={`relative group ${isOverlay ? 'z-50' : ''}`}
      >
        {editingId === service.id ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-3">
            <input 
              className="w-full px-3 py-2 border rounded text-sm" 
              value={editName} 
              onChange={e => setEditName(e.target.value)} 
              placeholder={t('ServiceName')}
            />
            <textarea 
              className="w-full px-3 py-2 border rounded text-sm" 
              value={editDesc} 
              onChange={e => setEditDesc(e.target.value)} 
              placeholder={t('Description')}
            />
            <input 
              className="w-full px-3 py-2 border rounded text-sm" 
              type="number" 
              value={editPrice} 
              onChange={e => setEditPrice(e.target.value)} 
              placeholder={t('Price')}
            />
            <input 
              className="w-full px-3 py-2 border rounded text-sm" 
              value={editServiceImageUrl} 
              onChange={e => setEditServiceImageUrl(e.target.value)} 
              placeholder="Image URL"
            />
            <input 
              className="w-full px-3 py-2 border rounded text-sm" 
              value={editPaymentLink} 
              onChange={e => setEditPaymentLink(e.target.value)} 
              placeholder={t('PaymentLinkPlaceholder')}
            />
            <input 
              className="w-full px-3 py-2 border rounded text-sm" 
              value={editFormUrl} 
              onChange={e => setEditFormUrl(e.target.value)} 
              placeholder="Form URL (Optional)"
            />
            <select 
              className="w-full px-3 py-2 border rounded text-sm"
              value={editType}
              onChange={e => setEditType(e.target.value as 'individual' | 'business' | 'workshop')}
            >
              <option value="individual">{t('Individual')}</option>
              <option value="business">{t('Business')}</option>
              <option value="workshop">{t('MasterClassesWorkshop')}</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={() => handleUpdate(service.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">{t('Save')}</button>
              <button onClick={() => setEditingId(null)} className="bg-slate-200 px-3 py-1 rounded text-xs">{t('Cancel')}</button>
            </div>
          </div>
        ) : (
          <ServiceDisplayCard 
            service={service} 
            className={isOverlay ? 'shadow-xl ring-2 ring-blue-500' : ''}
          >
            <div 
              {...attributes} 
              {...listeners} 
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 transition-opacity z-10"
            >
              <GripVertical size={20} />
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {service.performedBy && (
                  <span className="text-[10px] font-mono text-slate-400 italic">
                    ({t('AdminID')}: {service.performedBy})
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <button 
                    onClick={() => handleCopy(service)} 
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title={t('Copy')}
                  >
                    <Copy size={18} />
                  </button>
                )}
                {canEdit && (
                  <button 
                    onClick={() => startEditing(service)} 
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                <div className="relative">
                  {deleteConfirmId === service.id ? (
                    <div className="absolute right-0 bottom-0 flex flex-col items-end bg-white p-2 rounded shadow-lg border border-red-100 z-20 min-w-[140px] animate-in fade-in slide-in-from-bottom-2">
                      <p className="text-[10px] font-bold text-red-600 uppercase mb-1">
                        {deleteConfirmStep === 1 ? t('WarningAreYouSure') : t('FinalWarning')}
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setDeleteConfirmId(null); setDeleteConfirmStep(0); }}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                        >
                          {t('Cancel')}
                        </button>
                        <button 
                          onClick={() => handleDelete(service.id)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 underline"
                        >
                          {deleteConfirmStep === 1 ? t('Confirm') : t('DeleteNow')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    canEdit && (
                      <button 
                        onClick={() => handleDelete(service.id)} 
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </ServiceDisplayCard>
        )}
      </div>
    );
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('ServicesManagement')}</h1>
        {canEdit && (
          <button 
            onClick={() => seedDefaultServices()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition-all"
          >
            <Sparkles size={16} />
            Populate Professional Services
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input placeholder={t('ServiceName')} className="px-4 py-2 border rounded-lg" value={name} onChange={e => setName(e.target.value)} />
              <input placeholder={t('Description')} className="px-4 py-2 border rounded-lg" value={desc} onChange={e => setDesc(e.target.value)} />
              <input placeholder={t('Price')} type="number" className="px-4 py-2 border rounded-lg" value={price} onChange={e => setPrice(e.target.value)} />
              <input placeholder="Image URL" className="px-4 py-2 border rounded-lg" value={serviceImageUrl} onChange={e => setServiceImageUrl(e.target.value)} />
              <input placeholder={t('PaymentLinkPlaceholder')} className="px-4 py-2 border rounded-lg" value={paymentLink} onChange={e => setPaymentLink(e.target.value)} />
              <input placeholder="Form URL (Optional)" className="px-4 py-2 border rounded-lg" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
              <select 
                className="px-4 py-2 border rounded-lg"
                value={addingType}
                onChange={e => setAddingType(e.target.value as 'individual' | 'business' | 'workshop')}
              >
                <option value="individual">{t('Individual')}</option>
                <option value="business">{t('Business')}</option>
                <option value="workshop">{t('MasterClassesWorkshop')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg">{t('SaveService')}</button>
              <button onClick={() => setIsAdding(false)} className="bg-slate-200 px-6 py-2 rounded-lg">{t('Cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {/* Personal Services Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UserIcon className="text-green-600" size={24} />
              <h2 className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-900/10">{t('IndividualServices')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {clipboard && canEdit && (
                <button 
                  onClick={() => handlePaste('individual')}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  title={t('PasteHere')}
                >
                  <ClipboardCheck size={16} />
                  <span>{t('Paste')}</span>
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => { setAddingType('individual'); setIsAdding(true); }}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  title={t('AddService')}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder={t('SearchServices')}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={individualSearch}
              onChange={e => setIndividualSearch(e.target.value)}
            />
          </div>
          
          <SortableContext 
            id="individual-container"
            items={filteredIndividualServices.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 min-h-[100px]">
              {filteredIndividualServices.map(service => (
                <ServiceCard key={`individual-service-${service.id}`} service={service} />
              ))}
              {filteredIndividualServices.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400">{t('NoServicesFound')}</p>
                </div>
              )}
            </div>
          </SortableContext>
        </div>

        {/* MasterClasses / Coaching, Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PenTool className="text-blue-600" size={24} />
              <h2 className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-900/10">{t('MasterClassesWorkshop')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {clipboard && canEdit && (
                <button 
                  onClick={() => handlePaste('workshop')}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  title={t('PasteHere')}
                >
                  <ClipboardCheck size={16} />
                  <span>{t('Paste')}</span>
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => { setAddingType('workshop'); setIsAdding(true); }}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title={t('AddService')}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder={t('SearchServices')}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={workshopSearch}
              onChange={e => setWorkshopSearch(e.target.value)}
            />
          </div>
          
          <SortableContext 
            id="workshop-container"
            items={filteredWorkshopServices.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 min-h-[100px]">
              {filteredWorkshopServices.map(service => (
                <ServiceCard key={`workshop-service-${service.id}`} service={service} />
              ))}
              {filteredWorkshopServices.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400">{t('NoServicesFound')}</p>
                </div>
              )}
            </div>
          </SortableContext>
        </div>

        {/* Business Services Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FolderIcon className="text-purple-600" size={24} />
              <h2 className="px-4 py-2 bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-900/10">{t('BusinessServices')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {clipboard && canEdit && (
                <button 
                  onClick={() => handlePaste('business')}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  title={t('PasteHere')}
                >
                  <ClipboardCheck size={16} />
                  <span>{t('Paste')}</span>
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => { setAddingType('business'); setIsAdding(true); }}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title={t('AddService')}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder={t('SearchServices')}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={businessSearch}
              onChange={e => setBusinessSearch(e.target.value)}
            />
          </div>
          
          <SortableContext 
            id="business-container"
            items={filteredBusinessServices.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 min-h-[100px]">
              {filteredBusinessServices.map(service => (
                <ServiceCard key={`business-service-${service.id}`} service={service} />
              ))}
              {filteredBusinessServices.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400">{t('NoServicesFound')}</p>
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeId ? (
          <ServiceCard 
            service={services.find(s => s.id === activeId)!} 
            isOverlay 
          />
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
};

const AppointmentsList = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { isAdmin, profile, userTypeLabel, user } = useAuth();
  const [cancellingAppId, setCancellingAppId] = useState<string | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (!profile?.uid) return;
    if (!user) return;
    
    // For regular users, we MUST filter by clientId
    // For admins, we show everything
    const q = isAdmin 
      ? query(collection(db, 'appointments'))
      : query(collection(db, 'appointments'), where('clientId', '==', profile.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setAppointments(data);
    }, (err) => {
      console.error("Error fetching appointments:", err);
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });
    return unsubscribe;
  }, [isAdmin, profile?.uid]);

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = 
      app.service?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.assignedAdminName && app.assignedAdminName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const updateStatus = async (id: string, status: string) => {
    const appInfo = appointments.find(a => a.id === id);
    if (profile?.role === 'admin' && appInfo?.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    if (status === 'Cancelled') {
      setCancellingAppId(id);
      setShowCancelWarning(true);
      return;
    }
    await updateDoc(doc(db, 'appointments', id), { 
      status,
      audit: getAuditMetadata(profile, `Updated appointment status to ${status}`)
    });
    toast.success(`${t('Appointment')} ${t(status)}`);
  };

  const updatePaymentStatus = async (appointment: Appointment, paymentStatus: string, partialPayments?: PartialPayment[], paymentMethod?: string) => {
    if (profile?.role === 'admin' && appointment.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    let finalStatus = paymentStatus;
    if (paymentStatus === 'PaPay' && partialPayments) {
      const totalPaid = partialPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const fee = getServiceFee(appointment.service);
      if (fee > 0 && totalPaid >= fee) {
        finalStatus = 'FullPay';
      }
    }

    const updateData: any = { 
      paymentStatus: finalStatus,
      audit: getAuditMetadata(profile, `Updated payment status to ${finalStatus}${paymentMethod ? ` with method ${paymentMethod}` : ''}`)
    };
    if (partialPayments) {
      updateData.partialPayments = partialPayments;
    }
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
    }
    await updateDoc(doc(db, 'appointments', appointment.id), updateData);
    toast.success(`${t('PaymentStatusUpdatedTo')} ${t(finalStatus)}`);
  };

  const handleRestoreAppointment = async (id: string) => {
    const app = appointments.find(a => a.id === id);
    if (profile?.role === 'admin' && app?.clientId === profile.uid) {
      toast.error(t('AdminActionForSelfBlocked'));
      return;
    }
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'Process',
        createdAt: now,
        date: now,
        assignedAdminId: null,
        assignedAdminName: null,
        assignedAdminJobId: null,
        assignedBy: null,
        assignerAdminJobId: null,
        dueDate: null,
        mission: null,
        audit: getAuditMetadata(profile, 'Restored appointment')
      });
      toast.success(t('ServiceRestored') || 'Service restored successfully');
    } catch (error) {
      toast.error(t('FailedToRestoreService') || 'Failed to restore service');
    }
  };

  return (
    <div className="space-y-8">
      <YellowWarningModal 
        isOpen={showCancelWarning}
        onClose={() => {
          setShowCancelWarning(false);
          setCancellingAppId(null);
        }}
        requireReason={isAdmin}
        onConfirm={async (reason) => {
          if (cancellingAppId) {
            const appToCancel = appointments.find(a => a.id === cancellingAppId);
            if (profile?.role === 'admin' && appToCancel?.clientId === profile.uid) {
              toast.error(t('AdminActionForSelfBlocked'));
              return;
            }
            try {
              await updateDoc(doc(db, 'appointments', cancellingAppId), { 
                status: 'Cancelled',
                cancellationReason: reason || null,
                audit: getAuditMetadata(profile, `Cancelled service request${reason ? `: ${reason}` : ''}`)
              });
              toast.success(t('AppointmentStatusUpdated', { status: t('Cancelled') }));
            } catch (error) {
              toast.error(t('FailedToUpdateStatus'));
            }
          }
        }}
        title={t('CancelServiceWarningTitle') || 'Cancel Requested Service?'}
        message={t('CancelServiceWarningMessage') || 'Warning: This action will cancel the service request. This cannot be undone.'}
        confirmText={t('ConfirmCancellation') || 'Confirm Cancellation'}
      />
      <div className="flex flex-col lg:flex-row gap-8">
        {!isAdmin && (
          <div className="lg:w-1/3">
            <RequestServiceBlock />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-6">{t('ServiceHistory')}</h1>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={t('SearchServices') || "Search services, notes, status..."}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <select
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">{t('AllStatuses') || 'All Statuses'}</option>
            <option value="New">{t('New')}</option>
            <option value="Process">{t('Process')}</option>
            <option value="Complete">{t('Complete')}</option>
            <option value="Cancelled">{t('Cancelled')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 w-12">#</th>
              <th className="px-6 py-4">{t('Service')}</th>
              <th className="px-6 py-4">{t('Date')}</th>
              <th className="px-6 py-4">{t('ServiceFee')}</th>
              <th className="px-6 py-4">{t('Payment')}</th>
              <th className="px-6 py-4">{t('Status')}</th>
              {isAdmin && <th className="px-6 py-4">{t('AdminID')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center">
                  <Search className="mx-auto text-slate-300 mb-3" size={40} />
                  <p className="text-slate-500 font-medium">{t('NoResultsFound') || 'No results found'}</p>
                </td>
              </tr>
            ) : (
              filteredAppointments.map((app, index) => {
              // Extract fee from service string if it exists (e.g., "Service - $100")
              const feeMatch = app.service.match(/\$(\d+(\.\d+)?)/);
              const fee = feeMatch ? feeMatch[0] : '---';
              const serviceName = app.service.split(' - $')[0];

              return (
                <tr key={`service-history-${app.id}`}>
                  <td className="px-6 py-4 text-sm font-bold text-slate-400">{index + 1}</td>
                  <td className="px-6 py-4 font-medium">{serviceName}</td>
                  <td className="px-6 py-4 text-sm">
                    {app.date ? safeFormat(app.date, 'PPp') : '---'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{fee}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <select 
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded border border-slate-200 ${
                              (app.paymentStatus || 'no pay') === 'FullPay' ? 'bg-green-50 text-green-600' :
                              (app.paymentStatus || 'no pay') === 'PaPay' ? 'bg-amber-50 text-amber-600' :
                              'bg-red-50 text-red-600'
                            }`}
                            value={app.paymentStatus || 'no pay'}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'PaPay') {
                                const initialPayments = app.partialPayments && app.partialPayments.length > 0 
                                  ? app.partialPayments 
                                  : [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                updatePaymentStatus(app, newStatus, initialPayments, app.paymentMethod);
                              } else {
                                updatePaymentStatus(app, newStatus, undefined, app.paymentMethod);
                              }
                            }}
                          >
                            <option value="FullPay">{t('FullPay')}</option>
                            <option value="PaPay">{t('PaPay')}</option>
                            <option value="no pay">{t('no pay')}</option>
                          </select>
                          {(app.paymentStatus === 'FullPay' || app.paymentStatus === 'PaPay') && (
                            <select 
                              required
                              className={`text-[10px] font-bold uppercase px-2 py-1 rounded border outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                !app.paymentMethod ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'
                              }`}
                              value={app.paymentMethod || ''}
                              onChange={(e) => updatePaymentStatus(app, app.paymentStatus || 'no pay', app.partialPayments, e.target.value)}
                            >
                              <option value="">{t('Method')}</option>
                              <option value="Cash">{t('Cash')}</option>
                              <option value="Card">{t('Card')}</option>
                              <option value="BankTransfer">{t('BankTransfer')}</option>
                              <option value="Check">{t('Check')}</option>
                              <option value="Stripe">{t('Stripe')}</option>
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${app.paymentStatus === 'FullPay' ? 'bg-green-50 text-green-600' : app.paymentStatus === 'PaPay' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                          {t(app.paymentStatus || 'no pay')}
                          {app.paymentMethod && ` - ${t(app.paymentMethod)}`}
                        </span>
                      )}
                      {((app.paymentStatus || 'no pay') === 'PaPay' || ((app.paymentStatus || 'no pay') === 'FullPay' && app.partialPayments && app.partialPayments.length > 0)) && (
                        <div className="flex flex-col gap-2 mt-2 border-t border-slate-100 pt-2">
                          {(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }]).map((p, pIdx) => (
                            <div key={`service-history-partial-${app.id}-${pIdx}`} className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {isAdmin ? (
                                  <>
                                    <input 
                                      type="text"
                                      placeholder={t('Amount')}
                                      className="text-[10px] px-2 py-1 border rounded w-24 outline-none focus:ring-1 focus:ring-blue-500"
                                      defaultValue={p.amount}
                                      onBlur={(e) => {
                                        const newPayments = [...(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }])];
                                        newPayments[pIdx].amount = e.target.value;
                                        updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                                      }}
                                    />
                                    <select 
                                      required
                                      className={`text-[10px] px-2 py-1 border rounded outline-none focus:ring-1 focus:ring-blue-500 ${
                                        !p.method ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                                      }`}
                                      value={p.method || ''}
                                      onChange={(e) => {
                                        const newPayments = [...(app.partialPayments || [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }])];
                                        newPayments[pIdx].method = e.target.value;
                                        updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                                      }}
                                    >
                                      <option value="">{t('Method')}</option>
                                      <option value="Cash">{t('Cash')}</option>
                                      <option value="Card">{t('Card')}</option>
                                      <option value="BankTransfer">{t('BankTransfer')}</option>
                                      <option value="Check">{t('Check')}</option>
                                      <option value="Stripe">{t('Stripe')}</option>
                                    </select>
                                  </>
                                ) : (
                                  p.amount && (
                                    <span className="text-[10px] font-bold text-amber-600">
                                      {p.amount} {p.method && `(${t(p.method)})`}
                                    </span>
                                  )
                                )}
                              </div>
                              <span className="text-[9px] text-slate-500 italic">
                                {p.date}
                              </span>
                            </div>
                          ))}
                          {isAdmin && (app.paymentStatus || 'no pay') === 'PaPay' && (
                            <button 
                              onClick={() => {
                                const currentPayments = app.partialPayments && app.partialPayments.length > 0 
                                  ? app.partialPayments 
                                  : [{ amount: app.partialPaymentAmount || '', date: app.partialPaymentDate || format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                const newPayments = [...currentPayments, { amount: '', date: format(new Date(), 'yyyy-MM-dd HH:mm') }];
                                updatePaymentStatus(app, 'PaPay', newPayments, app.paymentMethod);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 mt-1"
                            >
                              <Plus size={12} /> {t('AddPayment')}
                            </button>
                          )}
                          <div className="text-[10px] font-bold text-blue-600 mt-1 border-t border-slate-100 pt-1">
                            {t('TotalPaid')}: ${ (app.partialPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2) }
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                <td className="px-6 py-4">
                  {isAdmin ? (
                    <select 
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded border border-slate-200 ${getStatusStyles(app.status || 'Process')}`}
                      value={app.status || 'Process'}
                      onChange={(e) => updateStatus(app.id, e.target.value as any)}
                    >
                      <option value="Complete">{t('Complete')}</option>
                      <option value="Process">{t('Process')}</option>
                      <option value="Cancelled">{t('Cancelled')}</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusStyles(app.status || 'Process')}`}>
                      {t(app.status || 'Process')}
                    </span>
                  )}
                  {app.status === 'Cancelled' && (
                    <button 
                      onClick={() => handleRestoreAppointment(app.id)}
                      className="ml-2 p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors inline-flex items-center justify-center"
                      title={t('RestoreService') || 'Restore Service'}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-500 italic">
                      {app.performedBy ? `(${t('AdminID')}: ${app.performedBy})` : '---'}
                    </span>
                  </td>
                )}
              </tr>
            );
          })
        )}
        </tbody>
        </table>
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <p className="text-sm font-bold text-slate-700">
            {t('Total')}: {filteredAppointments.length}
          </p>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  console.log('ProtectedRoute rendering', { adminOnly });
  const { user, profile, loading, isAdmin } = useAuth();
  
  const location = useLocation();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
      />
    </div>
  );

  if (!user) return <Navigate to={`/login${location.search}`} />;
  if (adminOnly && !isAdmin) return <Navigate to="/portal" />;
  
  // Only redirect to admin/portal if we are at the root or a generic route that isn't explicitly shared
  // For now, let's just make sure admins can access /profile
  return <Layout>{children}</Layout>;
};

const CalendarView = () => {
  const { t } = useTranslation();
  const [calendarUrl, setCalendarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const { isAdmin, profile } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedAdminCalendar, setSelectedAdminCalendar] = useState<string | null>(null);
  const [selectedAdminName, setSelectedAdminName] = useState<string | null>(null);
  const [viewingAdminProfile, setViewingAdminProfile] = useState<UserProfile | null>(null);
  const [externalExperts, setExternalExperts] = useState<any[]>([]);
  const [externalSearchTerm, setExternalSearchTerm] = useState('');
  const [externalZipFilter, setExternalZipFilter] = useState('');
  const [externalCityFilter, setExternalCityFilter] = useState('');
  const [externalCountryFilter, setExternalCountryFilter] = useState('');
  const [showExternalExpertModal, setShowExternalExpertModal] = useState(false);
  const [editingExternalExpert, setEditingExternalExpert] = useState<any>(null);
  const [externalExpertForm, setExternalExpertForm] = useState({
    displayName: '',
    photoURL: '',
    calendarUrl: '',
    topSpecialties: '',
    credentials: '',
    yearsOfExperience: '',
    city: '',
    stateProvince: '',
    country: '',
    zipCode: '',
    email: '',
    phoneNumber: '',
    languages: ''
  });
  const calendarRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    const fetchBranding = async () => {
      const docSnap = await getDoc(doc(db, 'branding', 'config'));
      if (docSnap.exists()) {
        setCalendarUrl(docSnap.data().calendarUrl || '');
      }
    };
    fetchBranding();

    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setAdmins(adminData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    const externalQ = query(collection(db, 'external_experts'), orderBy('createdAt', 'desc'));
    const unsubscribeExternal = onSnapshot(externalQ, (snapshot) => {
      const externalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExternalExperts(externalData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'external_experts');
    });

    return () => {
      unsubscribe();
      unsubscribeExternal();
    };
  }, [profile]);

  useEffect(() => {
    if (selectedAdminCalendar && calendarRef.current) {
      calendarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedAdminCalendar]);

  const handleSaveExternalExpert = async () => {
    if (!externalExpertForm.displayName) {
      toast.error(t('NameRequired') || 'Name is required');
      return;
    }

    try {
      if (editingExternalExpert) {
        await updateDoc(doc(db, 'external_experts', editingExternalExpert.id), {
          ...externalExpertForm,
          updatedAt: new Date().toISOString()
        });
        toast.success(t('ExpertUpdated'));
      } else {
        await addDoc(collection(db, 'external_experts'), {
          ...externalExpertForm,
          createdAt: new Date().toISOString()
        });
        toast.success(t('ExpertCreated'));
      }
      setShowExternalExpertModal(false);
      setEditingExternalExpert(null);
      setExternalExpertForm({
        displayName: '',
        photoURL: '',
        calendarUrl: '',
        topSpecialties: '',
        credentials: '',
        yearsOfExperience: '',
        city: '',
        stateProvince: '',
        country: '',
        zipCode: '',
        email: '',
        phoneNumber: '',
        languages: ''
      });
    } catch (error) {
      handleFirestoreError(error, editingExternalExpert ? OperationType.UPDATE : OperationType.CREATE, 'external_experts');
    }
  };

  const handleDeleteExternalExpert = async (id: string) => {
    if (!window.confirm(t('ConfirmDeleteExpert') || 'Are you sure you want to delete this expert?')) return;
    try {
      await deleteDoc(doc(db, 'external_experts', id));
      toast.success(t('ExpertDeleted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'external_experts');
    }
  };

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'branding', 'config'), {
        calendarUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success(t('CalendarUrlUpdated'));
    } catch (error) {
      toast.error(t('FailedToUpdateCalendarUrl'));
    }
  };

  const filteredAdmins = admins.filter(admin => {
    if (admin.status !== 'active') return false;
    const matchesSearch = (admin.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (admin.topSpecialties || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (admin.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZip = !zipFilter || (admin.zipCode || '').toLowerCase().includes(zipFilter.toLowerCase());
    const matchesCity = !cityFilter || (admin.city || '').toLowerCase().includes(cityFilter.toLowerCase());
    const matchesCountry = !countryFilter || (admin.country || '').toLowerCase().includes(countryFilter.toLowerCase());
    
    return matchesSearch && matchesZip && matchesCity && matchesCountry;
  });

  const filteredExternalExperts = externalExperts.filter(expert => {
    const matchesSearch = (expert.displayName || '').toLowerCase().includes(externalSearchTerm.toLowerCase()) ||
                         (expert.topSpecialties || '').toLowerCase().includes(externalSearchTerm.toLowerCase()) ||
                         (expert.credentials || '').toLowerCase().includes(externalSearchTerm.toLowerCase());
    const matchesZip = !externalZipFilter || (expert.zipCode || '').toLowerCase().includes(externalZipFilter.toLowerCase());
    const matchesCity = !externalCityFilter || (expert.city || '').toLowerCase().includes(externalCityFilter.toLowerCase());
    const matchesCountry = !externalCountryFilter || (expert.country || '').toLowerCase().includes(externalCountryFilter.toLowerCase());
    
    return matchesSearch && matchesZip && matchesCity && matchesCountry;
  });

  if (loading) return <div className="flex justify-center p-12"><Clock className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('TrustedExpertsCalendarProfiles')}</h1>
      </div>

      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <p className="text-blue-800 font-medium">
          {t('TrustedExpertsIntro')}
        </p>
      </div>

      {/* Admin Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-2 text-slate-600 mb-2">
          <Search size={18} />
          <span className="font-semibold">{t('SearchAndFilterExperts')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('NameOrSpecialty')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('ZipCode') || "Zip Code"}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={zipFilter}
              onChange={(e) => setZipFilter(e.target.value)}
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('City') || "City"}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('Country') || "Country"}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Admin Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => (
          <motion.div
            key={`admin-profile-card-${admin.uid}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={`bg-white p-6 rounded-xl shadow-sm border transition-all cursor-pointer group ${selectedAdminCalendar === admin.calendarUrl ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-100 hover:shadow-md'}`}
            onClick={() => setViewingAdminProfile(admin)}
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden border-2 border-white shadow-sm relative group-hover:border-blue-200 transition-colors">
                {admin.photoURL ? (
                  <img src={admin.photoURL} alt={admin.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={32} />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                  <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{admin.displayName}</h3>
                  <Eye size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-sm text-slate-500 truncate font-medium">
                  {t('TrustedExpert', 'TRUSTED EXPERT')}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                  <MapPin size={12} />
                  <span className="truncate">{[admin.city, admin.stateProvince, admin.country].filter(Boolean).join(', ')}</span>
                </div>
              </div>
            </div>
            {admin.topSpecialties && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-blue-500" />
                  {t('TopSpecialties')}
                </p>
                <p className="text-sm text-slate-600 line-clamp-2 italic">"{admin.topSpecialties}"</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-400">{t('Joined')}: {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (admin.calendarUrl) {
                    setSelectedAdminCalendar(admin.calendarUrl);
                    setSelectedAdminName(admin.displayName);
                  } else {
                    toast.info(t('NoCalendarConfigured'));
                  }
                }}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
              >
                {t('ScheduleAppointment')}
                <ChevronRight size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredAdmins.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
          <Users className="mx-auto text-slate-200 mb-4" size={64} />
          <p className="text-slate-500 font-medium">{t('NoAdministratorsFound')}</p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setZipFilter('');
              setCityFilter('');
              setCountryFilter('');
            }}
            className="mt-4 text-blue-600 font-semibold hover:underline"
          >
            {t('ClearFilters') || 'Clear all filters'}
          </button>
        </div>
      )}

      {/* External Experts Block */}
      <div className="pt-12 border-t border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">{t('ExternalExperts')}</h2>
          {isAdmin && (
            <button
              onClick={() => {
                setEditingExternalExpert(null);
                setExternalExpertForm({
                  displayName: '',
                  photoURL: '',
                  calendarUrl: '',
                  topSpecialties: '',
                  credentials: '',
                  yearsOfExperience: '',
                  city: '',
                  stateProvince: '',
                  country: '',
                  zipCode: '',
                  email: '',
                  phoneNumber: '',
                  languages: ''
                });
                setShowExternalExpertModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              {t('AddExternalExpert')}
            </button>
          )}
        </div>

        {/* External Expert Search and Filters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4 mb-8">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Search size={18} />
            <span className="font-semibold">{t('ExternalExperts', 'External Experts')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder={t('NameOrSpecialty')}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={externalSearchTerm}
                onChange={(e) => setExternalSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder={t('ZipCode') || "Zip Code"}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={externalZipFilter}
                onChange={(e) => setExternalZipFilter(e.target.value)}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder={t('City') || "City"}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={externalCityFilter}
                onChange={(e) => setExternalCityFilter(e.target.value)}
              />
            </div>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder={t('Country') || "Country"}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={externalCountryFilter}
                onChange={(e) => setExternalCountryFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* External Expert Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExternalExperts.map((expert) => (
            <motion.div
              key={`expert-card-${expert.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className={`bg-white p-6 rounded-xl shadow-sm border transition-all cursor-pointer group ${selectedAdminCalendar === expert.calendarUrl ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-100 hover:shadow-md'}`}
              onClick={() => setViewingAdminProfile(expert)}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden border-2 border-white shadow-sm relative group-hover:border-blue-200 transition-colors">
                  {expert.photoURL ? (
                    <img src={expert.photoURL} alt={expert.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={32} />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{expert.displayName}</h3>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingExternalExpert(expert);
                              setExternalExpertForm({
                                displayName: expert.displayName || '',
                                photoURL: expert.photoURL || '',
                                calendarUrl: expert.calendarUrl || '',
                                topSpecialties: expert.topSpecialties || '',
                                credentials: expert.credentials || '',
                                yearsOfExperience: expert.yearsOfExperience || '',
                                city: expert.city || '',
                                stateProvince: expert.stateProvince || '',
                                country: expert.country || '',
                                zipCode: expert.zipCode || '',
                                email: expert.email || '',
                                phoneNumber: expert.phoneNumber || '',
                                languages: expert.languages || ''
                              });
                              setShowExternalExpertModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExternalExpert(expert.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <Eye size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 truncate font-medium">
                    {t('ExternalExpert', 'EXTERNAL EXPERT')}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                    <MapPin size={12} />
                    <span className="truncate">{[expert.city, expert.stateProvince, expert.country].filter(Boolean).join(', ')}</span>
                  </div>
                </div>
              </div>
              {expert.topSpecialties && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles size={12} className="text-blue-500" />
                    {t('TopSpecialties')}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-2 italic">"{expert.topSpecialties}"</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                <span className="text-xs text-slate-400">{t('Joined')}: {expert.createdAt ? new Date(expert.createdAt).toLocaleDateString() : 'N/A'}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (expert.calendarUrl) {
                      setSelectedAdminCalendar(expert.calendarUrl);
                      setSelectedAdminName(expert.displayName);
                    } else {
                      toast.info(t('NoCalendarConfigured'));
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                >
                  {t('ScheduleAppointment')}
                  <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredExternalExperts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
            <Users className="mx-auto text-slate-200 mb-4" size={64} />
            <p className="text-slate-500 font-medium">{t('NoExternalExpertsFound', 'No external experts found')}</p>
            <button 
              onClick={() => {
                setExternalSearchTerm('');
                setExternalZipFilter('');
                setExternalCityFilter('');
                setExternalCountryFilter('');
              }}
              className="mt-4 text-blue-600 font-semibold hover:underline"
            >
              {t('ClearFilters') || 'Clear all filters'}
            </button>
          </div>
        )}
      </div>

      {/* External Expert Modal */}
      <AnimatePresence>
        {showExternalExpertModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-600 text-white">
                <h2 className="text-xl font-bold">{editingExternalExpert ? t('EditExternalExpert') : t('AddExternalExpert')}</h2>
                <button onClick={() => setShowExternalExpertModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('ExpertName')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.displayName}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, displayName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('PhotoURL')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.photoURL}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, photoURL: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('CalendarLink')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.calendarUrl}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, calendarUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Email')}</label>
                    <input
                      type="email"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.email}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('PhoneNumber')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.phoneNumber}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Languages')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.languages}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, languages: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Specialties')}</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 h-24"
                    value={externalExpertForm.topSpecialties}
                    onChange={(e) => setExternalExpertForm({ ...externalExpertForm, topSpecialties: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Credentials')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.credentials}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, credentials: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Experience')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.yearsOfExperience}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, yearsOfExperience: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('City')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.city}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('State')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.stateProvince}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, stateProvince: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Country')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.country}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('ZipCode')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={externalExpertForm.zipCode}
                      onChange={(e) => setExternalExpertForm({ ...externalExpertForm, zipCode: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button
                  onClick={handleSaveExternalExpert}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {editingExternalExpert ? t('UpdateExpert') || 'Update Expert' : t('SaveExpert') || 'Save Expert'}
                </button>
                <button
                  onClick={() => setShowExternalExpertModal(false)}
                  className="px-8 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  {t('Cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selected Admin Calendar View */}
      {selectedAdminCalendar && (
        <motion.div 
          ref={calendarRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-xl shadow-lg border border-blue-100 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <CalendarDays size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('ScheduleAppointment')}</h2>
                <p className="text-sm text-slate-500">{t('With') || 'With'} <span className="font-bold text-blue-600">{selectedAdminName}</span></p>
              </div>
            </div>
            <button 
              onClick={() => {
                setSelectedAdminCalendar(null);
                setSelectedAdminName(null);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          <div className="aspect-[16/10] w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
            <iframe 
              src={selectedAdminCalendar} 
              className="w-full h-full border-none"
              title={t('CalendarView')}
            />
          </div>
          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-slate-500 italic">{t('CalendarLoadingNote') || 'If the calendar doesn\'t load, click the link to open it in a new tab.'}</p>
            <a 
              href={selectedAdminCalendar} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-2 text-sm font-bold transition-colors"
            >
              <ExternalLink size={16} />
              {t('OpenInNewTab')}
            </a>
          </div>
        </motion.div>
      )}

      {/* Global Calendar Config (Admin Only) removed */}

      {/* Admin Profile Modal */}
      <AnimatePresence>
        {viewingAdminProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl my-auto"
            >
              <div className="relative h-24 bg-gradient-to-r from-blue-600 to-indigo-700">
                <button 
                  onClick={() => setViewingAdminProfile(null)}
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors z-10"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 pb-6 -mt-10 relative">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 p-1 shadow-xl overflow-hidden shrink-0 mb-4 relative group">
                    {viewingAdminProfile.photoURL ? (
                      <img src={viewingAdminProfile.photoURL} alt={viewingAdminProfile.displayName} className="w-full h-full object-cover rounded-[22px]" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-700 text-slate-400 rounded-[22px]">
                        <UserIcon size={40} />
                      </div>
                    )}
                    {isAdmin && (
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="text-white" size={24} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500000) {
                              toast.error(t('FileTooLarge'));
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              try {
                                const expertId = (viewingAdminProfile as any).id || viewingAdminProfile.uid;
                                const isExternal = externalExperts.some(ex => ex.id === expertId);
                                if (isExternal) {
                                  await updateDoc(doc(db, 'external_experts', expertId), { photoURL: base64 });
                                } else {
                                  await updateDoc(doc(db, 'users', viewingAdminProfile.uid), { photoURL: base64 });
                                }
                                setViewingAdminProfile(prev => prev ? { ...prev, photoURL: base64 } : null);
                                toast.success(t('PhotoUpdated'));
                              } catch (err) {
                                console.error("Photo update failed:", err);
                                toast.error("Failed to update photo");
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{viewingAdminProfile.displayName}</h2>
                    <p className="text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center gap-2 text-sm">
                      <Briefcase size={16} />
                      {t('TrustedExpert', 'TRUSTED EXPERT')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('ContactInformation') || 'Contact Information'}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <Mail size={14} />
                          </div>
                          <span className="text-xs font-medium truncate">{viewingAdminProfile.email}</span>
                        </div>
                        {viewingAdminProfile.phoneNumber && (
                          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                              <Phone size={14} />
                            </div>
                            <span className="text-xs font-medium truncate">{viewingAdminProfile.phoneNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <MapPin size={14} />
                          </div>
                          <span className="text-xs font-medium truncate">{[viewingAdminProfile.city, viewingAdminProfile.stateProvince, viewingAdminProfile.country].filter(Boolean).join(', ')}</span>
                        </div>
                        {viewingAdminProfile.languages && (
                          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                              <Globe size={14} />
                            </div>
                            <span className="text-xs font-medium truncate">{viewingAdminProfile.languages}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {viewingAdminProfile.topSpecialties && (
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('TopSpecialties')}</h4>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
                          <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                            {viewingAdminProfile.topSpecialties}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {viewingAdminProfile.credentials && (
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('Credentials')}</h4>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                              {viewingAdminProfile.credentials}
                            </p>
                          </div>
                        </div>
                      )}

                      {viewingAdminProfile.yearsOfExperience && (
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('YearsOfExperience')}</h4>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 h-full flex items-center">
                            <p className="text-slate-700 dark:text-slate-200 text-xs font-bold">
                              {viewingAdminProfile.yearsOfExperience}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button
                    onClick={() => {
                      if (viewingAdminProfile.calendarUrl) {
                        setSelectedAdminCalendar(viewingAdminProfile.calendarUrl);
                        setSelectedAdminName(viewingAdminProfile.displayName);
                        setViewingAdminProfile(null);
                      } else {
                        toast.info(t('NoCalendarConfigured'));
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 text-sm"
                  >
                    <CalendarDays size={18} />
                    {t('ScheduleAppointment')}
                  </button>
                  <button
                    onClick={() => setViewingAdminProfile(null)}
                    className="px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
                  >
                    {t('Close')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isAdmin && <RequestServiceBlock />}
    </div>
  );
};

const Payments = () => {
  const { user, isAdmin, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [stripeLink, setStripeLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(doc(db, 'global_config', 'payment'), (docSnap) => {
      if (docSnap.exists()) {
        setStripeLink(docSnap.data().stripeLink || '');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'global_config/payment'));
    return () => unsub();
  }, []);

  // Handle successful payment return
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isSuccess = searchParams.get('success') === 'true';
    const pendingAppId = localStorage.getItem('pending_payment_app_id');

    if (isSuccess && pendingAppId) {
      const markAsPaid = async () => {
        try {
          await updateDoc(doc(db, 'appointments', pendingAppId), {
            paymentStatus: 'FullPay',
            updatedAt: new Date().toISOString(),
            paymentConfirmedAt: new Date().toISOString()
          });
          toast.success(t('PaymentConfirmed') || 'Payment confirmed and service marked as paid!');
          localStorage.removeItem('pending_payment_app_id');
          // Clean up URL
          navigate('/portal/payments', { replace: true });
        } catch (error) {
          console.error('Error marking as paid:', error);
        }
      };
      markAsPaid();
    }
  }, [location.search, navigate, t]);

  const handleSaveLink = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'global_config', 'payment'), {
        stripeLink,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid
      }, { merge: true });
      toast.success(t('PaymentLinkSaved') || 'Payment link saved successfully!');
    } catch (error) {
      toast.error(t('FailedToSavePaymentLink') || 'Failed to save payment link');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">{isAdmin ? t('PaymentManagement') : t('MyPayments')}</h1>
      </div>

      {isAdmin ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <CreditCard size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('StripePaymentLink') || 'Stripe Payment Link'}</h2>
              <p className="text-sm text-slate-500">{t('StripePaymentLinkDesc') || 'Configure the payment link that clients will use to pay for services.'}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('StripeLinkUrl') || 'Stripe Payment Link URL'}
              </label>
              <input
                type="url"
                value={stripeLink}
                onChange={(e) => setStripeLink(e.target.value)}
                placeholder="https://buy.stripe.com/..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveLink}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50"
            >
              {isSaving ? t('Saving') : t('SaveLink') || 'Save Link'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard size={32} />
          </div>
          <h2 className="text-xl font-bold mb-8">{t('MakeAPayment')}</h2>
          <div className="flex flex-col items-center gap-4">
            <a 
              href={stripeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold flex items-center gap-2"
            >
              <ExternalLink size={20} />
              {t('Pay Here') || 'Pay Here'}
            </a>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                    {t('SecurePaymentPortal') || 'Secure Payment Portal'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stripeLink}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative">
              {stripeLink ? (
                <iframe 
                  src={stripeLink} 
                  className="w-full h-full border-none"
                  title="Stripe Payment"
                  onLoad={(e) => {
                    // We can't detect if it's blocked by X-Frame-Options easily via JS
                    // but we can provide a fallback link
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <AlertCircle size={48} className="text-amber-500 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">
                    {t('NoPaymentLinkConfigured') || 'No payment link has been configured yet. Please contact support.'}
                  </p>
                </div>
              )}
              {/* Fallback overlay in case iframe is blocked */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-4 max-w-md w-full">
                <div className="text-sm text-slate-600 dark:text-slate-300 flex-1">
                  {t('IframeBlockedHint') || 'If the payment page doesn\'t load, click the button to open it in a new tab.'}
                </div>
                <a 
                  href={stripeLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {t('OpenInNewTab') || 'Open in New Tab'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && <RequestServiceBlock />}
    </div>
  );
};

interface SignatureField {
  id: string;
  type: 'signature' | 'text' | 'date';
  x: number;
  y: number;
  width?: number;
  height?: number;
  page: number;
  label?: string;
  required: boolean;
}

interface SignatureTemplate {
  id: string;
  name: string;
  pdfUrl: string;
  fields: SignatureField[];
  createdAt: string;
  createdBy: string;
}

interface SignatureRequest {
  id: string;
  templateId: string;
  templateName: string;
  userId: string;
  userName: string;
  status: 'pending' | 'signed' | 'declined';
  fieldValues: Record<string, string>;
  sentAt: string;
  signedAt?: string;
  pdfUrl: string;
  fields: SignatureField[];
  consentCertificate?: string;
  audit: AuditMetadata;
}

const PDFPage = ({ pdf, pageNumber, onClick }: { pdf: any, pageNumber: number, onClick: (e: React.MouseEvent, page: number) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        setLoading(false);
      } catch (error) {
        console.error(`Error rendering page ${pageNumber}:`, error);
      }
    };
    renderPage();
  }, [pdf, pageNumber]);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <RefreshCw className="animate-spin text-blue-600" size={24} />
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        className="cursor-crosshair max-w-full h-auto block" 
        onClick={(e) => onClick(e, pageNumber)}
      />
      <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm z-20">
        {pageNumber}
      </div>
    </>
  );
};

const PDFPageContainer = ({ 
  pageNo, 
  pdf, 
  onClick, 
  fields, 
  isEditMode, 
  onUpdateField, 
  onCopyField, 
  onDeleteField,
  fieldValues,
  t
}: { 
  pageNo: number, 
  pdf: any, 
  onClick: (e: React.MouseEvent, page: number) => void,
  fields: SignatureField[],
  isEditMode: boolean,
  onUpdateField?: (id: string, updates: Partial<SignatureField>) => void,
  onCopyField?: (field: SignatureField) => void,
  onDeleteField?: (id: string) => void,
  fieldValues?: Record<string, string>,
  t: any
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    
    // Initial check
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      id={`pdf-page-${pageNo}`} 
      className="relative mb-12 shadow-2xl bg-white overflow-hidden mx-auto border border-slate-200" 
      style={{ width: 'fit-content', minHeight: '100px' }}
    >
      <PDFPage pdf={pdf} pageNumber={pageNo} onClick={onClick} />
      
      {dimensions.width > 0 && dimensions.height > 0 && fields.filter(f => f.page === pageNo).map((field) => {
        const isFilled = fieldValues && fieldValues[field.id];
        
        if (isEditMode) {
          return (
            <Rnd
              key={`pdf-field-rnd-${field.id}`}
              size={{ width: field.width || 150, height: field.height || 40 }}
              position={{ 
                x: (field.x / 100) * dimensions.width, 
                y: (field.y / 100) * dimensions.height
              }}
              onDragStop={(e, d) => {
                if (dimensions.width <= 0 || dimensions.height <= 0) return;
                const x = (d.x / dimensions.width) * 100;
                const y = (d.y / dimensions.height) * 100;
                onUpdateField?.(field.id, { 
                  x: Math.max(0, Math.min(100, Number(x.toFixed(2)))), 
                  y: Math.max(0, Math.min(100, Number(y.toFixed(2)))) 
                });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                if (dimensions.width <= 0 || dimensions.height <= 0) return;
                const x = (position.x / dimensions.width) * 100;
                const y = (position.y / dimensions.height) * 100;
                onUpdateField?.(field.id, { 
                  width: parseInt(ref.style.width), 
                  height: parseInt(ref.style.height),
                  x: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
                  y: Math.max(0, Math.min(100, Number(y.toFixed(2))))
                });
              }}
              enableResizing={{
                top: true, right: true, bottom: true, left: true,
                topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
              }}
              minWidth={50}
              minHeight={20}
              bounds="parent"
              className="z-20 group"
              dragHandleClassName="field-drag-handle"
            >
              <div className="relative w-full h-full bg-white/90 backdrop-blur-sm border-2 border-blue-500 rounded shadow-lg flex items-center justify-center overflow-hidden">
                <div className="field-drag-handle absolute inset-0 cursor-move z-10 opacity-0 group-hover:opacity-10 transition-opacity bg-blue-500" />
                <div className="field-drag-handle absolute top-0 left-0 right-0 h-6 cursor-move bg-blue-500/10 flex items-center px-2 z-20">
                  <GripVertical size={12} className="text-blue-500" />
                  <span className="text-[8px] font-black text-blue-600 uppercase ml-1 truncate">{field.label || field.type}</span>
                </div>
                <input 
                  type="text"
                  value={field.label || ''}
                  onChange={(e) => onUpdateField?.(field.id, { label: e.target.value })}
                  className="w-full h-full pt-6 pb-2 px-2 bg-transparent outline-none text-[10px] font-bold text-blue-700 text-center z-30 relative"
                  placeholder={t('FieldLabel', 'Label')}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-40 bg-blue-600 rounded-bl shadow-sm">
                  {onCopyField && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyField(field);
                      }}
                      className="text-white p-1.5 hover:bg-blue-700 transition-colors"
                      title={t('Copy')}
                    >
                      <Copy size={12} />
                    </button>
                  )}
                  {onDeleteField && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteField(field.id);
                      }}
                      className="text-white p-1.5 hover:bg-red-600 transition-colors"
                      title={t('Delete')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </Rnd>
          );
        }

        return (
          <div 
            key={`pdf-field-box-${field.id}`}
            className="absolute group z-20"
            style={{ 
              left: `${(field.x / 100) * dimensions.width}px`, 
              top: `${(field.y / 100) * dimensions.height}px`,
              width: field.width ? `${field.width}px` : '100px',
              height: field.height ? `${field.height}px` : '30px',
              transform: 'translate(0, 0)'
            }}
          >
            <div className="relative w-full h-full">
              <div className={`w-full h-full rounded p-1 flex items-center justify-center text-[9px] font-bold backdrop-blur-sm border-2 transition-all bg-white ${
                isFilled 
                  ? 'border-green-500 text-green-700' 
                  : 'border-blue-500 text-blue-700'
              }`}>
                {fieldValues?.[field.id] ? (
                  <span className={field.type === 'signature' ? 'font-serif italic text-xs' : ''}>
                    {fieldValues[field.id]}
                  </span>
                ) : (
                  <>
                    {field.label || field.type}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PDFViewer = ({ 
  file, 
  onLoadSuccess, 
  onClick, 
  fields, 
  onDeleteField, 
  onUpdateField,
  onCopyField,
  fieldValues,
  isEditMode = false
}: { 
  file: any, 
  onLoadSuccess: (numPages: number) => void, 
  onClick: (e: React.MouseEvent, page: number) => void, 
  fields: SignatureField[], 
  onDeleteField?: (id: string) => void,
  onUpdateField?: (id: string, updates: Partial<SignatureField>) => void,
  onCopyField?: (field: SignatureField) => void,
  fieldValues?: Record<string, string>,
  isEditMode?: boolean
}) => {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const loadPdf = async () => {
      if (!file) return;
      try {
        const loadingTask = pdfjsLib.getDocument(file);
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        onLoadSuccess(loadedPdf.numPages);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    loadPdf();
  }, [file]);

  if (!pdf) return (
    <div className="flex items-center justify-center p-20">
      <RefreshCw className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full">
      {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNo => (
        <PDFPageContainer
          key={`pdf-page-${pageNo}`}
          pageNo={pageNo}
          pdf={pdf}
          onClick={onClick}
          fields={fields}
          isEditMode={isEditMode}
          onUpdateField={onUpdateField}
          onCopyField={onCopyField}
          onDeleteField={onDeleteField}
          fieldValues={fieldValues}
          t={t}
        />
      ))}
    </div>
  );
};

const Signatures = () => {
  const { isAdmin, profile, user: authUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create-template' | 'send-request' | 'sign'>('list');
  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SignatureTemplate | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTemplates, setSearchTemplates] = useState('');
  const [searchRequests, setSearchRequests] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateFile, setNewTemplateFile] = useState<File | null>(null);
  const [newTemplateFields, setNewTemplateFields] = useState<SignatureField[]>([]);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [adminSignature, setAdminSignature] = useState(profile?.adminSignature || '');
  const [isSavingAdminSig, setIsSavingAdminSig] = useState(false);
  const [preFilledValues, setPreFilledValues] = useState<Record<string, string>>({});
  const [showSignConfirm, setShowSignConfirm] = useState(false);

  useEffect(() => {
    if (newTemplateFile) {
      const url = URL.createObjectURL(newTemplateFile);
      setPdfPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (isEditingTemplate && selectedTemplate?.pdfUrl) {
      setPdfPreviewUrl(selectedTemplate.pdfUrl);
    } else {
      setPdfPreviewUrl(null);
    }
  }, [newTemplateFile, isEditingTemplate, selectedTemplate]);

  // Template Creation State
  const [isUploading, setIsUploading] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [saveTemplateOnSend, setSaveTemplateOnSend] = useState(true);
  const [selectedFieldType, setSelectedFieldType] = useState<{type: string, label: string} | null>(null);

  // Send Request State
  const [targetUserId, setTargetUserId] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const generateConsentCertificate = (request: SignatureRequest, profile: UserProfile) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(t('ConsentCertificateTitle', 'Certificate of Consent to Electronic Signature'), pageWidth / 2, 20, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(20, 25, pageWidth - 20, 25);
    
    // Content
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105); // slate-600
    const text = t('ConsentCertificateText', 'This document serves as an official record of consent for electronic signature provided by {{name}}. By checking the consent box and completing the signature process, the user acknowledges and agrees that their electronic signature is the legal equivalent of a manual/handwritten signature on this document.', { name: profile.displayName });
    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, 40);
    
    // Details Table
    autoTable(doc, {
      startY: 60,
      head: [[t('Field'), t('Value')]],
      body: [
        [t('DocumentName'), request.templateName],
        [t('SignerName'), profile.displayName],
        [t('SignerEmail'), profile.email],
        [t('SignerUID'), profile.uid],
        [t('DateTime'), new Date().toLocaleString()],
        [t('ConsentStatus'), t('Accepted')],
        [t('IPAddress'), t('Recorded')]
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] } // blue-600
    });
    
    // Signature at the bottom
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(t('UserSignature', 'User Signature:'), 20, finalY);
    
    doc.setFont('courier', 'italic');
    doc.text(profile.displayName || '', 60, finalY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(t('ElectronicallySignedByOn', 'Electronically signed by {{name}} on {{date}}', { name: profile.displayName, date: new Date().toLocaleDateString() }), 60, finalY + 5);
    
    return doc.output('datauristring');
  };

  useEffect(() => {
    if (selectedRequest) {
      setFieldValues(selectedRequest.fieldValues || {});
    } else {
      setFieldValues({});
    }
  }, [selectedRequest]);

  useEffect(() => {
    if (!profile) return;
    const unsubTemplates = onSnapshot(collection(db, 'signature_templates'), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SignatureTemplate)));
    }, (error) => {
      console.error("Signature templates error:", error);
      handleFirestoreError(error, OperationType.LIST, 'signature_templates');
    });

    const qRequests = isAdmin 
      ? collection(db, 'signature_requests')
      : query(collection(db, 'signature_requests'), where('userId', '==', authUser?.uid));
    
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as SignatureRequest)));
      setLoading(false);
    }, (error) => {
      console.error("Signature requests error:", error);
      handleFirestoreError(error, OperationType.LIST, 'signature_requests');
    });

    if (isAdmin) {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (error) => {
        console.error("Users list error for admin:", error);
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
      return () => {
        unsubTemplates();
        unsubRequests();
        unsubUsers();
      };
    }

    return () => {
      unsubTemplates();
      unsubRequests();
    };
  }, [isAdmin, authUser]);

  const handleCreateTemplate = async (sendNow = false) => {
    if (!newTemplateFile && !isEditingTemplate) return;
    if (!newTemplateName) return;
    setIsUploading(true);
    try {
      const templateData = {
        name: newTemplateName,
        fields: newTemplateFields,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.uid
      };

      let templateId = selectedTemplate?.id;

      if (newTemplateFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64 = e.target?.result as string;
            if (isEditingTemplate && selectedTemplate) {
              await updateDoc(doc(db, 'signature_templates', selectedTemplate.id), {
                ...templateData,
                pdfUrl: base64
              });
              toast.success(t('TemplateUpdated'));
            } else {
              const docRef = await addDoc(collection(db, 'signature_templates'), {
                ...templateData,
                pdfUrl: base64,
                createdAt: new Date().toISOString(),
                createdBy: profile?.uid
              });
              templateId = docRef.id;
              toast.success(t('TemplateCreatedSuccessfully'));
            }
            
            if (sendNow && templateId) {
              const targetUser = users.find(u => u.uid === targetUserId);
              await addDoc(collection(db, 'signature_requests'), {
                templateId: templateId,
                templateName: newTemplateName,
                pdfUrl: base64,
                fields: newTemplateFields,
                userId: targetUserId,
                userName: targetUser?.displayName || 'Unknown User',
                status: 'pending',
                fieldValues: {},
                sentAt: new Date().toISOString(),
                audit: getAuditMetadata(profile, 'Sent signature request')
              });
              toast.success(t('SignatureRequestSent'));
            }
            resetTemplateForm();
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'signature_templates');
          }
        };
        reader.readAsDataURL(newTemplateFile);
      } else if (isEditingTemplate && selectedTemplate) {
        if (saveTemplateOnSend || !sendNow) {
          await updateDoc(doc(db, 'signature_templates', selectedTemplate.id), templateData);
          toast.success(t('TemplateUpdated'));
        }

        if (sendNow) {
          const targetUser = users.find(u => u.uid === targetUserId);
          await addDoc(collection(db, 'signature_requests'), {
            templateId: selectedTemplate.id,
            templateName: newTemplateName,
            pdfUrl: selectedTemplate.pdfUrl,
            fields: newTemplateFields,
            userId: targetUserId,
            userName: targetUser?.displayName || 'Unknown User',
            status: 'pending',
            fieldValues: {},
            sentAt: new Date().toISOString(),
            audit: getAuditMetadata(profile, 'Sent signature request')
          });
          toast.success(t('SignatureRequestSent'));
        }
        resetTemplateForm();
      }
    } catch (error) {
      toast.error(isEditingTemplate ? t('FailedToUpdateTemplate') : t('FailedToCreateTemplate'));
    } finally {
      setIsUploading(false);
      setShowUserSelector(false);
    }
  };

  const handleSendWithoutSaving = async () => {
    if (!targetUserId || !newTemplateName) return;
    setIsUploading(true);
    try {
      const targetUser = users.find(u => u.uid === targetUserId);
      
      let pdfUrl = selectedTemplate?.pdfUrl;
      if (newTemplateFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          pdfUrl = e.target?.result as string;
          await sendRequest(pdfUrl);
        };
        reader.readAsDataURL(newTemplateFile);
      } else {
        await sendRequest(pdfUrl || '');
      }

      async function sendRequest(url: string) {
        await addDoc(collection(db, 'signature_requests'), {
          templateId: selectedTemplate?.id || 'one-off',
          templateName: newTemplateName,
          pdfUrl: url,
          fields: newTemplateFields,
          userId: targetUserId,
          userName: targetUser?.displayName || t('UnknownUser', 'Unknown User'),
          status: 'pending',
          fieldValues: {},
          sentAt: new Date().toISOString(),
          audit: getAuditMetadata(profile, 'Sent signature request')
        });
        toast.success(t('SignatureRequestSent'));
        resetTemplateForm();
        setIsUploading(false);
        setShowUserSelector(false);
      }
    } catch (error) {
      toast.error(t('FailedToSendRequest'));
      setIsUploading(false);
    }
  };

  const resetTemplateForm = () => {
    setView('list');
    setNewTemplateName('');
    setNewTemplateFile(null);
    setNewTemplateFields([]);
    setIsEditingTemplate(false);
    setSelectedTemplate(null);
  };

  const handleResendRequest = (req: SignatureRequest) => {
    setSelectedTemplate(templates.find(t => t.id === req.templateId) || null);
    setTargetUserId(req.userId);
    setView('send-request');
    toast.info(t('CorrectAndResendInfo', 'You can now correct the recipient or template and resend the request.'));
  };

  const handleSendRequest = async () => {
    if (!selectedTemplate || !targetUserId || !profile) return;
    const targetUser = users.find(u => u.uid === targetUserId);
    try {
      await addDoc(collection(db, 'signature_requests'), {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        pdfUrl: selectedTemplate.pdfUrl,
        fields: selectedTemplate.fields,
        userId: targetUserId,
        userName: targetUser?.displayName || t('UnknownUser', 'Unknown User'),
        status: 'pending',
        fieldValues: preFilledValues,
        sentAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, 'Sent signature request')
      });
      toast.success(t('SignatureRequestSent'));
      setView('list');
      setSelectedTemplate(null);
      setTargetUserId('');
      setPreFilledValues({});
    } catch (error) {
      toast.error(t('FailedToSendRequest'));
      handleFirestoreError(error, OperationType.CREATE, 'signature_requests');
    }
  };

  const handleSignRequest = async (fieldValues: Record<string, string>) => {
    if (!selectedRequest || !profile) return;
    
    const hasEmptyRequiredFields = selectedRequest.fields.some(f => f.required && !fieldValues[f.id]);
    
    if (hasEmptyRequiredFields) {
      toast.error(t('PleaseFillAllRequiredFields'));
      return;
    }

    try {
      const consentCertificate = generateConsentCertificate(selectedRequest, profile);
      
      await updateDoc(doc(db, 'signature_requests', selectedRequest.id), {
        status: 'signed',
        fieldValues,
        signedAt: new Date().toISOString(),
        consentCertificate,
        audit: getAuditMetadata(profile, 'Signed document')
      });
      toast.success(t('DocumentSignedSuccessfully'));
      setView('list');
      setSelectedRequest(null);
      setConsentChecked(false);
    } catch (error) {
      toast.error(t('FailedToSignDocument'));
      handleFirestoreError(error, OperationType.UPDATE, `signature_requests/${selectedRequest.id}`);
    }
  };

  const handleSaveAdminSignature = async () => {
    if (!profile) return;
    setIsSavingAdminSig(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        adminSignature: adminSignature
      });
      toast.success(t('AdminSignatureSaved', 'Admin signature saved successfully!'));
    } catch (error) {
      console.error("Error saving admin signature:", error);
      toast.error(t('FailedToSaveAdminSignature', 'Failed to save admin signature'));
    } finally {
      setIsSavingAdminSig(false);
    }
  };

  useEffect(() => {
    if (view === 'sign' && selectedRequest && profile) {
      // Pre-populate signature field with client name by default
      const initialValues = { ...selectedRequest.fieldValues };
      selectedRequest.fields.forEach(field => {
        if (field.type === 'signature' && !initialValues[field.id]) {
          initialValues[field.id] = profile.displayName || '';
        }
      });
      setFieldValues(initialValues);
      setIsLocked(selectedRequest.status === 'signed');
    }
  }, [view, selectedRequest, profile]);

  if (view === 'create-template') {
    const fieldTypes = [
      { type: 'signature', label: t('Signature', 'Signature'), icon: PenTool },
      { type: 'text', label: t('Initial', 'Initial'), icon: Type },
      { type: 'date', label: t('Date', 'Date'), icon: Calendar },
      { type: 'text', label: t('Text', 'Text'), icon: FileText },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={resetTemplateForm} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEditingTemplate ? t('EditTemplate') : t('CreateSignatureTemplate')}
            </h1>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('TemplateName')}</label>
            <input 
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('EnterTemplateName')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('UploadPDF')}</label>
            {!pdfPreviewUrl ? (
              <div 
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('pdf-upload')?.click()}
              >
                <FileText size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">{t('ClickToUploadPDF')}</p>
                <input 
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setNewTemplateFile(e.target.files?.[0] || null)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={20} />
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {newTemplateFile ? newTemplateFile.name : selectedTemplate?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setNewTemplateFile(null);
                        setPdfPreviewUrl(null);
                        setNewTemplateFields([]);
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1"
                    >
                      {t('Remove')}
                    </button>
                    <button 
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                      className="text-xs font-bold text-blue-500 hover:text-blue-600 px-3 py-1"
                    >
                      {t('Change')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* DocuSign-like Sidebar */}
                  <div className="w-full md:w-48 flex-shrink-0 space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('StandardFields', 'Standard Fields')}</h3>
                    {fieldTypes.map((ft, idx) => (
                      <button
                        key={`${ft.type}-${idx}`}
                        onClick={() => {
                          setSelectedFieldType({ type: ft.type, label: ft.label });
                          toast.info(t('FieldSelectedClickToPaste', 'Field selected. Click on the PDF to paste it.'));
                        }}
                        className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-all group ${
                          selectedFieldType?.type === ft.type && selectedFieldType?.label === ft.label
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md'
                        }`}
                      >
                        <div className={`p-2 rounded-lg transition-colors ${
                          selectedFieldType?.type === ft.type && selectedFieldType?.label === ft.label
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-400 group-hover:text-blue-500'
                        }`}>
                          <ft.icon size={18} />
                        </div>
                        <span className={`text-xs font-bold ${
                          selectedFieldType?.type === ft.type && selectedFieldType?.label === ft.label
                            ? 'text-blue-700'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>{ft.label}</span>
                      </button>
                    ))}

                    {adminSignature && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                        <button
                          onClick={() => {
                            setSelectedFieldType({ type: 'signature', label: t('SavedSignature', 'Saved Signature') });
                            setPreFilledValues(prev => ({ ...prev, ['temp_sig']: adminSignature }));
                            toast.info(t('SavedSignatureSelected', 'Saved signature selected. Click on the PDF to place it.'));
                          }}
                          className={`w-full flex flex-col items-center gap-2 p-4 border rounded-xl transition-all group ${
                            selectedFieldType?.label === t('SavedSignature', 'Saved Signature')
                              ? 'bg-green-50 border-green-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-green-500 hover:shadow-md'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('SavedSignature', 'Saved Signature')}</div>
                          <div className="font-serif italic text-lg text-slate-800 dark:text-slate-200">{adminSignature}</div>
                          <div className="text-[10px] text-blue-600 font-bold mt-2">{t('ClickToPlace', 'Click to place')}</div>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 min-h-[500px]">
                    <div className="flex justify-center p-4 overflow-auto max-h-[800px] bg-slate-200 dark:bg-slate-950 rounded-xl custom-scrollbar">
                      <div className="relative" style={{ width: 'fit-content' }}>
                        <PDFViewer
                          file={pdfPreviewUrl}
                          onLoadSuccess={(n) => setNumPages(n)}
                          fields={newTemplateFields}
                          isEditMode={true}
                          onDeleteField={(id) => setNewTemplateFields(newTemplateFields.filter(f => f.id !== id))}
                          onUpdateField={(id, updates) => {
                            setNewTemplateFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
                          }}
                          onCopyField={(field) => {
                            const newField = {
                              ...field,
                              id: Math.random().toString(36).substr(2, 9),
                              x: field.x + 2,
                              y: field.y + 2
                            };
                            setNewTemplateFields([...newTemplateFields, newField]);
                            toast.success(t('FieldCopied'));
                          }}
                          onClick={(e, page) => {
                            if (!selectedFieldType) {
                              toast.warning(t('SelectFieldFirst', 'Please select a field from the sidebar first.'));
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            
                            const newField: SignatureField = {
                              id: Math.random().toString(36).substr(2, 9),
                              type: selectedFieldType.type as any,
                              x: Number(x.toFixed(2)),
                              y: Number(y.toFixed(2)),
                              width: 150,
                              height: 40,
                              page: page,
                              label: selectedFieldType.label,
                              required: true
                            };

                            if (selectedFieldType.label === t('SavedSignature', 'Saved Signature')) {
                              setPreFilledValues(prev => ({ ...prev, [newField.id]: adminSignature }));
                            }

                            setNewTemplateFields([...newTemplateFields, newField]);
                            setSelectedFieldType(null);
                            toast.success(t('FieldPasted', 'Field pasted at position.'));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center">
                  {t('ClickOnPDFToAddField', 'Click anywhere on the PDF to add a signature or text field at that location.')}
                </p>
              </div>
            )}
            <input 
              id="pdf-upload"
              type="file" 
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setNewTemplateFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="pt-4 space-y-3">
            <button 
              onClick={() => setShowUserSelector(true)}
              disabled={(!newTemplateFile && !isEditingTemplate) || !newTemplateName || isUploading}
              className="w-full py-4 bg-white dark:bg-slate-800 text-blue-600 border-2 border-blue-600 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
            >
              {t('SendRequest', 'Send Request')}
            </button>
            <button 
              onClick={() => handleCreateTemplate()}
              disabled={(!newTemplateFile && !isEditingTemplate) || !newTemplateName || isUploading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isUploading ? t('Uploading') : (isEditingTemplate ? t('Save') : t('CreateTemplate'))}
            </button>
          </div>
        </div>

        {/* User Selector Modal for Send Request */}
        <AnimatePresence>
          {showUserSelector && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('SelectRecipient', 'Select Recipient')}</h3>
                
                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('SelectUser')}</label>
                    <select 
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('ChooseUser')}</option>
                      {users.map(u => (
                        <option key={`selector-user-option-${u.uid}`} value={u.uid}>{u.displayName} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  {isEditingTemplate && (
                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={saveTemplateOnSend}
                        onChange={(e) => setSaveTemplateOnSend(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('SaveChangesToTemplate', 'Save changes to original template')}
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowUserSelector(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    disabled={!targetUserId || isUploading}
                    onClick={() => {
                      if (isEditingTemplate && !saveTemplateOnSend) {
                        handleSendWithoutSaving();
                      } else {
                        handleCreateTemplate(true);
                      }
                    }}
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    {isUploading ? t('Sending...') : t('SendNow', 'Send Now')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'send-request') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('SendSignatureRequest')}</h1>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('SelectTemplate')}</label>
            <select 
              value={selectedTemplate?.id || ''}
              onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('ChooseTemplate')}</option>
              {templates.map(t => (
                <option key={`signature-template-opt-${t.id}`} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('SelectUser')}</label>
            <select 
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('ChooseUser')}</option>
              {users.map(u => (
                <option key={`signature-user-option-${u.uid}`} value={u.uid}>{u.displayName} ({u.email})</option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('PreFillFields', 'Pre-fill Fields (Optional)')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTemplate.fields.map(field => (
                  <div key={`sig-prefill-field-${field.id}`} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{field.label || t(field.type)}</label>
                    {field.type === 'signature' ? (
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={preFilledValues[field.id] || ''}
                          onChange={(e) => setPreFilledValues({ ...preFilledValues, [field.id]: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-serif italic"
                          placeholder={t('TypeSignature', 'Type signature...')}
                        />
                        {adminSignature && (
                          <button 
                            onClick={() => setPreFilledValues({ ...preFilledValues, [field.id]: adminSignature })}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                          >
                            {t('UseSaved', 'Use Saved')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <input 
                        type="text"
                        value={preFilledValues[field.id] || ''}
                        onChange={(e) => setPreFilledValues({ ...preFilledValues, [field.id]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('EnterValue', 'Enter value...')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            <button 
              onClick={handleSendRequest}
              disabled={!selectedTemplate || !targetUserId}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {t('SendRequest')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'sign' && selectedRequest) {
    const template = templates.find(t => t.id === selectedRequest.templateId);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('SignDocument')}: {selectedRequest.templateName}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-[800px] overflow-y-auto custom-scrollbar">
            {selectedRequest?.pdfUrl ? (
              <div className="relative w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                <PDFViewer 
                  file={selectedRequest.pdfUrl}
                  onLoadSuccess={() => {}}
                  fields={selectedRequest.fields}
                  onClick={() => {}}
                  fieldValues={fieldValues}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileWarning size={48} className="mb-4" />
                <p>{t('DocumentNotFound')}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <PenTool size={20} className="text-blue-600" />
                {t('RequiredFields', 'Required Fields')}
              </h3>
              
              <div className="space-y-4">
                {selectedRequest?.fields.map(field => {
                  const isAdminFilled = selectedRequest.fieldValues?.[field.id] && !isAdmin; // If admin filled it and we are not admin
                  const isFieldLocked = isLocked || isAdminFilled;

                  return (
                    <div key={`sig-req-field-${field.id}`} className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {field.label || t(field.type)} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'signature' ? (
                        <div className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-serif italic text-slate-700 dark:text-slate-300">
                          {fieldValues[field.id] || profile?.displayName || ''}
                        </div>
                      ) : field.type === 'date' ? (
                        <input 
                          type="date"
                          value={fieldValues[field.id] || ''}
                          disabled={isFieldLocked}
                          onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-70"
                        />
                      ) : (
                        <input 
                          type="text"
                          value={fieldValues[field.id] || ''}
                          disabled={isFieldLocked}
                          onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-70"
                          placeholder={t('EnterText', 'Enter text...')}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="pt-6 space-y-3">
                  <button 
                    onClick={() => {
                      setIsLocked(true);
                      setShowSignConfirm(true);
                    }}
                    disabled={selectedRequest?.fields.some(f => f.required && !fieldValues[f.id])}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                  >
                    {t('SignAndComplete')}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
                    {t('SignDisclaimer', 'By clicking "Sign & Complete", you agree that this electronic signature is as legally binding as a handwritten signature.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <ShieldCheck size={16} />
                {t('AuditLog', 'Audit Log')}
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {t('AuditLogDesc', 'This document signature process is tracked. Your IP address, timestamp, and identity are recorded for legal verification.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Signature Confirmation Modal */}
      <AnimatePresence>
        {showSignConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <PenTool size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('ConfirmSignature', 'Confirm Signature')}
                </h3>
              </div>
              
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                {t('ConfirmSignDocument', 'Please confirm that you have reviewed and agree to sign this document')}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowSignConfirm(false);
                    setIsLocked(false);
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  {t('Cancel')}
                </button>
                <button 
                  onClick={() => {
                    setShowSignConfirm(false);
                    handleSignRequest(fieldValues);
                  }}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {t('Confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Consent Modal */}
      <AnimatePresence>
        {showConsentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('ElectronicSignatureConsent')}
                </h3>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t('ConsentText', 'By proceeding, you agree to use electronic signatures for this document. You acknowledge that your electronic signature is as legally binding as a handwritten signature.')}
                </p>
                
                <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                  <input 
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
                    {t('IAgreeToElectronicSignatureConsent', 'I agree to the electronic signature consent and acknowledge its legal validity.')}
                  </span>
                </label>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowConsentModal(false);
                    setConsentChecked(false);
                    setSelectedRequest(null);
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  {t('Cancel')}
                </button>
                <button 
                  disabled={!consentChecked}
                  onClick={() => {
                    setShowConsentModal(false);
                    setView('sign');
                  }}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {t('Proceed')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isAdmin ? t('SignatureManagement') : t('MySignatures')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isAdmin ? t('ManageTemplatesAndRequests') : t('ViewAndSignDocuments')}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <button 
                onClick={() => setView('create-template')}
                className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <FilePlus size={20} className="text-blue-600" />
                {t('NewTemplate')}
              </button>
              <button 
                onClick={() => setView('send-request')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
              >
                <Send size={20} />
                {t('SendRequest')}
              </button>
            </div>
            
            {/* Admin Signature Block */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('PreSavedSignature', 'Pre-saved Signature')}</h3>
                <button 
                  onClick={handleSaveAdminSignature}
                  disabled={isSavingAdminSig}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {isSavingAdminSig ? t('Saving...') : t('Save')}
                </button>
              </div>
              <input 
                type="text"
                value={adminSignature}
                onChange={(e) => setAdminSignature(e.target.value)}
                placeholder={t('TypeYourSignature', 'Type your signature here...')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-serif italic"
              />
              <p className="text-[9px] text-slate-400 italic">{t('AdminSignatureHint', 'This signature can be used on templates.')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Inbox size={20} className="text-blue-600" />
                {isAdmin ? t('AllRequests') : t('MyInbox')}
              </h2>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder={t('SearchRequests')}
                  value={searchRequests}
                  onChange={(e) => setSearchRequests(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">{t('Document')}</th>
                    <th className="px-6 py-4">{isAdmin ? t('Recipient') : t('SentAt')}</th>
                    <th className="px-6 py-4 text-center">{t('Status')}</th>
                    <th className="px-6 py-4 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {requests.filter(r => 
                    r.templateName.toLowerCase().includes(searchRequests.toLowerCase()) ||
                    r.userName.toLowerCase().includes(searchRequests.toLowerCase())
                  ).length > 0 ? requests.filter(r => 
                    r.templateName.toLowerCase().includes(searchRequests.toLowerCase()) ||
                    r.userName.toLowerCase().includes(searchRequests.toLowerCase())
                  ).map((req) => (
                    <tr key={`signature-request-row-${req.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <FileText size={18} />
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{req.templateName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{req.userName}</span>
                            <span className="text-[10px] text-slate-500">{safeFormat(req.sentAt, 'MMM d, yyyy HH:mm')}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-600 dark:text-slate-400">{safeFormat(req.sentAt, 'MMM d, yyyy HH:mm')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'signed' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                            req.status === 'declined' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                            'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {t(req.status)}
                          </span>
                          {req.status === 'signed' && req.signedAt && (
                            <span className="text-[9px] text-slate-500 mt-1">{safeFormat(req.signedAt, 'MMM d, yyyy HH:mm')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {req.status === 'pending' && !isAdmin ? (
                            <button 
                              onClick={() => {
                                setSelectedRequest(req);
                                setShowConsentModal(true);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 dark:shadow-none"
                            >
                              {t('SignNow')}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setView('sign');
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                title={t('ViewDocument')}
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = req.pdfUrl;
                                  link.download = `${req.templateName}.pdf`;
                                  link.click();
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                title={t('DownloadDocument')}
                              >
                                <Download size={18} />
                              </button>
                              {req.status === 'signed' && req.consentCertificate && (
                                <button 
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = req.consentCertificate!;
                                    link.download = `Consent_${req.templateName}.pdf`;
                                    link.click();
                                  }}
                                  className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                                  title={t('DownloadConsentCertificate')}
                                >
                                  <ShieldCheck size={18} />
                                </button>
                              )}
                            </div>
                          )}
                          {isAdmin && (
                            <button 
                              onClick={() => handleResendRequest(req)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                              title={t('ResendRequest')}
                            >
                              <RotateCcw size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        {t('NoSignatureRequestsFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isAdmin && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={20} className="text-blue-600" />
                  {t('Templates')}
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder={t('SearchTemplates')}
                    value={searchTemplates}
                    onChange={(e) => setSearchTemplates(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-4 space-y-3">
                {templates.filter(t => t.name.toLowerCase().includes(searchTemplates.toLowerCase())).length > 0 ? templates.filter(t => t.name.toLowerCase().includes(searchTemplates.toLowerCase())).map((tpl) => (
                  <div key={`sig-tpl-sidebar-${tpl.id}`} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 text-slate-400 group-hover:text-blue-600 transition-colors rounded-lg shadow-sm">
                        <FileText size={16} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{tpl.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setSelectedTemplate(tpl);
                          setNewTemplateName(tpl.name);
                          setNewTemplateFields(tpl.fields);
                          setIsEditingTemplate(true);
                          setView('create-template');
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-8 text-slate-400 text-xs italic">{t('NoTemplatesFound')}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-500/20">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('SecureSigning')}</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              {t('SecureSigningDesc', 'All documents are encrypted and legally binding. Signatures are tracked with audit logs for your security.')}
            </p>
            <div className="flex items-center gap-2 text-xs font-bold bg-white/10 w-fit px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {t('SystemActive')}
            </div>
          </div>
        </div>
      </div>
      
      {!isAdmin && <RequestServiceBlock />}
    </div>
  );
};

const Resources = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const blocks = [
    { id: 'hr', title: t('HumanResources'), icon: Users, color: 'bg-blue-600' },
    { id: 'mobile', title: t('MobileAssets'), icon: FolderIcon, color: 'bg-emerald-600' },
    { id: 'realestate', title: t('RealEstateAssets'), icon: HomeIcon, color: 'bg-indigo-600' },
    { id: 'others', title: t('Others'), icon: Sparkles, color: 'bg-amber-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('Resources')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {t('ResourcesDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {blocks.map((block, index) => (
          <motion.div
            key={`resource-block-${block.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="group relative bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-6 cursor-pointer hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
          >
            <div className={`w-20 h-20 ${block.color} text-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-transform duration-300`}>
              <block.icon size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {block.title}
              </h2>
              <div className="h-1 w-12 bg-slate-100 dark:bg-slate-700 mx-auto rounded-full group-hover:w-20 group-hover:bg-blue-500 transition-all duration-300" />
            </div>
          </motion.div>
        ))}
      </div>
      
      {!isAdmin && <RequestServiceBlock />}
    </div>
  );
};

const SalesTeam = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<'main' | 'reps'>('main');

  const mainBlocks = [
    { id: 'reps', title: t('SalesRepresentatives'), icon: Users, color: 'bg-blue-600', action: () => setCurrentView('reps') },
    { id: 'dashboard', title: t('SalesDashboard'), icon: LayoutDashboard, color: 'bg-emerald-600' },
  ];

  const repBlocks = [
    { id: 'training', title: t('TrainingAndResources'), icon: FolderIcon, color: 'bg-indigo-600' },
    { id: 'prospects', title: t('Prospects'), icon: Search, color: 'bg-amber-600' },
    { id: 'sales', title: t('Sales'), icon: CreditCard, color: 'bg-rose-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {currentView !== 'main' && (
            <button
              onClick={() => setCurrentView('main')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {currentView === 'main' ? t('SalesTeam') : t('SalesRepresentatives')}
          </h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {t('SalesTeamDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
        {(currentView === 'main' ? mainBlocks : repBlocks).map((block: any, index) => (
          <motion.div
            key={`sales-block-${block.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.02 }}
            onClick={block.action}
            className="group relative bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-6 cursor-pointer hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
          >
            <div className={`w-20 h-20 ${block.color} text-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-transform duration-300`}>
              <block.icon size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {block.title}
              </h2>
              <div className="h-1 w-12 bg-slate-100 dark:bg-slate-700 mx-auto rounded-full group-hover:w-20 group-hover:bg-blue-500 transition-all duration-300" />
            </div>
          </motion.div>
        ))}
      </div>
      
      {!isAdmin && <RequestServiceBlock />}
    </div>
  );
};

const DEFAULT_TEMPLATES = [
  { id: '1', formId: '001', title: 'General Intake Form', description: 'Basic client information collection.', fields: [{ id: 'f1', label: 'Full Name', type: 'text', required: true }, { id: 'f2', label: 'Email', type: 'email', required: true }] },
  { id: '2', formId: '002', title: 'Medical History Form', description: 'Collect patient medical history.', fields: [{ id: 'f1', label: 'Current Medications', type: 'textarea', required: false }] },
  { id: '3', formId: '003', title: 'Client Registration', description: 'New client registration form.', fields: [{ id: 'f1', label: 'Username', type: 'text', required: true }] },
  { id: '4', formId: '004', title: 'Service Request Form', description: 'Request a specific service.', fields: [{ id: 'f1', label: 'Service Type', type: 'select', required: true, options: ['Consultation', 'Implementation', 'Support'] }] },
  { id: '5', formId: '005', title: 'Feedback Form', description: 'Collect user feedback.', fields: [{ id: 'f1', label: 'Rating', type: 'number', required: true }] },
  { id: '6', formId: '006', title: 'Incident Report', description: 'Report an incident or issue.', fields: [{ id: 'f1', label: 'Date of Incident', type: 'date', required: true }] },
  { id: '7', formId: '007', title: 'Employee Onboarding', description: 'New employee onboarding information.', fields: [{ id: 'f1', label: 'Department', type: 'text', required: true }] },
  { id: '8', formId: '008', title: 'Contractor Agreement', description: 'Agreement for independent contractors.', fields: [{ id: 'f1', label: 'Contract Duration', type: 'text', required: true }] },
  { id: '9', formId: '009', title: 'Referral Form', description: 'Submit a referral.', fields: [{ id: 'f1', label: 'Referred By', type: 'text', required: true }] },
  { id: '10', formId: '010', title: 'Appointment Request', description: 'Request an appointment.', fields: [{ id: 'f1', label: 'Preferred Date', type: 'date', required: true }] },
  { id: '11', formId: '011', title: 'Consent Form', description: 'General consent for services.', fields: [{ id: 'f1', label: 'I agree to the terms', type: 'checkbox', required: true }] },
  { id: '12', formId: '012', title: 'Liability Waiver', description: 'Waiver of liability.', fields: [{ id: 'f1', label: 'Signature', type: 'text', required: true }] },
  { id: '13', formId: '013', title: 'Expense Reimbursement', description: 'Request reimbursement for expenses.', fields: [{ id: 'f1', label: 'Amount', type: 'number', required: true }] },
  { id: '14', formId: '014', title: 'Time Off Request', description: 'Request time off from work.', fields: [{ id: 'f1', label: 'Start Date', type: 'date', required: true }] },
  { id: '15', formId: '015', title: 'Performance Review', description: 'Employee performance review form.', fields: [{ id: 'f1', label: 'Self Assessment', type: 'textarea', required: true }] },
  { id: '16', formId: '016', title: 'Customer Satisfaction Survey', description: 'Survey to measure customer satisfaction.', fields: [{ id: 'f1', label: 'How likely are you to recommend us?', type: 'number', required: true }] },
  { id: '17', formId: '017', title: 'Event Registration', description: 'Register for an upcoming event.', fields: [{ id: 'f1', label: 'Event Name', type: 'text', required: true }] },
  { id: '18', formId: '018', title: 'Membership Application', description: 'Apply for membership.', fields: [{ id: 'f1', label: 'Membership Level', type: 'select', required: true, options: ['Basic', 'Premium', 'VIP'] }] },
  { id: '19', formId: '019', title: 'Volunteer Signup', description: 'Sign up for volunteer opportunities.', fields: [{ id: 'f1', label: 'Interests', type: 'text', required: false }] },
  { id: '20', formId: '020', title: 'Project Proposal', description: 'Submit a new project proposal.', fields: [{ id: 'f1', label: 'Project Title', type: 'text', required: true }] },
];

const FormsBank = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('templates'); // 'templates', 'edit', 'submissions'
  const [selectedSubmissionTemplate, setSelectedSubmissionTemplate] = useState<FormTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAdmin) return;

    const q = collection(db, 'form_templates');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        const seedTemplates = async () => {
          try {
            const batchPromises = DEFAULT_TEMPLATES.map(template => 
              setDoc(doc(db, 'form_templates', template.id), template)
            );
            await Promise.all(batchPromises);
          } catch (error) {
            console.error('Error seeding templates:', error);
            handleFirestoreError(error, OperationType.WRITE, 'form_templates');
            setLoading(false);
          }
        };
        seedTemplates();
      } else {
        const fetchedTemplates = snapshot.docs.map(doc => doc.data()) as FormTemplate[];
        
        // Ensure all templates have a formId
        const needsUpdate = fetchedTemplates.some(t => !t.formId);
        if (needsUpdate) {
          const updateTemplates = async () => {
            try {
              const updates = fetchedTemplates.map((template, index) => {
                if (!template.formId) {
                  const formId = (index + 1).toString().padStart(3, '0');
                  return setDoc(doc(db, 'form_templates', template.id), { ...template, formId });
                }
                return Promise.resolve();
              });
              await Promise.all(updates);
            } catch (error) {
              console.error('Error updating templates with formId:', error);
            }
          };
          updateTemplates();
        }

        setTemplates(fetchedTemplates.sort((a, b) => (a.formId || '').localeCompare(b.formId || '')));
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching templates:', error);
      handleFirestoreError(error, OperationType.GET, 'form_templates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin, t]);

  const generateFormId = () => {
    const existingIds = templates.map(t => parseInt(t.formId));
    let nextId = 1;
    while (existingIds.includes(nextId)) {
      nextId++;
    }
    return nextId.toString().padStart(3, '0');
  };

  const handleCreateNew = () => {
    const newTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      formId: generateFormId(),
      title: 'New Form Template',
      description: 'Customize your new form here.',
      fields: [{ id: 'f1', label: 'Full Name', type: 'text', required: true }]
    };
    setSelectedTemplate(newTemplate);
    setView('edit');
  };

  const handleSave = async (updatedTemplate) => {
    try {
      await setDoc(doc(db, 'form_templates', updatedTemplate.id), updatedTemplate);
      toast.success(t('TemplateUpdated'));
      setView('templates');
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      handleFirestoreError(error, OperationType.UPDATE, `form_templates/${updatedTemplate.id}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
    </div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('FormsBank')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('FormsBankDescription')}</p>
        
        {view === 'templates' && (
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              {t('CreateNewForms')}
            </button>
            <button
              onClick={() => setView('submissions')}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm font-medium"
            >
              <Table className="w-5 h-5" />
              {t('FormContentTables')}
            </button>
          </div>
        )}

        {view === 'templates' && (
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
            <input
              type="text"
              placeholder={t('SearchFormsPlaceholder') || "Search by title or ID..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        )}
        
        {view !== 'templates' && (
          <button
            onClick={() => {
              setView('templates');
              setSelectedTemplate(null);
              setSelectedSubmissionTemplate(null);
            }}
            className="mt-4 flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('BackToTemplates')}
          </button>
        )}
      </div>

      {view === 'edit' && selectedTemplate && (
        <TemplateEditor 
          template={selectedTemplate} 
          onSave={handleSave} 
          onCancel={() => {
            setView('templates');
            setSelectedTemplate(null);
          }} 
        />
      )}

      {view === 'submissions' && (
        <FormSubmissions 
          templates={templates}
          selectedTemplate={selectedSubmissionTemplate}
          onSelectTemplate={setSelectedSubmissionTemplate}
        />
      )}

      {view === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates
            .filter(t => 
              t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
              t.formId.includes(searchTerm)
            )
            .map(template => (
            <motion.div
              key={`form-template-card-${template.id}`}
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-500">
                      #{template.formId}
                    </span>
                    <button
                      onClick={() => {
                        const shareUrl = `${window.location.origin}/#/forms/${template.formId}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success(t('LinkCopied') || 'Share link copied to clipboard!');
                      }}
                      className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t('ShareThisForm') || 'Share this form'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setView('edit');
                  }}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                >
                  {t('Edit')}
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{template.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{template.description}</p>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {template.fields.length} {t('Fields')}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const FormSubmissions = ({ templates, selectedTemplate, onSelectTemplate }: { 
  templates: FormTemplate[], 
  selectedTemplate: FormTemplate | null, 
  onSelectTemplate: (t: FormTemplate | null) => void 
}) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedTemplate) return;

    setLoading(true);
    const q = query(
      collection(db, 'form_submissions'),
      where('templateId', '==', selectedTemplate.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FormSubmission[];
      setSubmissions(fetched.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching submissions:', error);
      handleFirestoreError(error, OperationType.GET, 'form_submissions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedTemplate]);

  if (!selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('SearchTablesPlaceholder') || "Search form content tables..."}
            value={tableSearchTerm}
            onChange={(e) => setTableSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates
            .filter(t => 
              t.title.toLowerCase().includes(tableSearchTerm.toLowerCase()) || 
              t.formId.includes(tableSearchTerm)
            )
            .map(template => (
            <button
              key={`intake-form-table-${template.id}`}
              onClick={() => onSelectTemplate(template)}
              className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-left"
            >
            <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
              <Table className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <div className="text-xs font-mono text-slate-400">#{template.formId}</div>
              <div className="font-bold text-slate-900 dark:text-white">{template.title}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('Submissions')}: {selectedTemplate.title} (#{selectedTemplate.formId})
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg border-2 border-blue-100 dark:border-blue-800 text-xs">
            <Share2 className="w-3 h-3" />
            <span className="font-mono">{`${window.location.origin}/#/forms/${selectedTemplate.formId}`}</span>
          </div>
        </div>
        <button
          onClick={() => onSelectTemplate(null)}
          className="text-sm text-blue-600 hover:underline"
        >
          {t('BackToTables')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500">{t('NoSubmissionsFound')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{t('FormID')}</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{t('ClientName')}</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{t('SubmittedAt')}</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {submissions.map(sub => (
                <tr key={`form-submission-row-${sub.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">#{sub.formId}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-medium">{sub.clientName}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {format(parseISO(sub.submittedAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setViewingSubmission(sub)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-bold"
                    >
                      {t('ViewData')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingSubmission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('SubmissionDetails')}</h3>
              <button onClick={() => setViewingSubmission(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {Object.entries(viewingSubmission.data).map(([key, value]) => (
                <div key={`submission-field-${viewingSubmission.id}-${key}`} className="space-y-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {selectedTemplate.fields.find(f => f.id === key)?.label || key}
                  </div>
                  <div className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    {typeof value === 'object' && value !== null && 'data' in value ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">{value.name} ({(value.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <a 
                          href={value.data} 
                          download={value.name}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          {t('Download') || 'Download'}
                        </a>
                      </div>
                    ) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const PublicForm = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [readingFile, setReadingFile] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchTemplate = async () => {
      try {
        // Try fetching by document ID first
        let docSnap = await getDoc(doc(db, 'form_templates', id));
        if (docSnap.exists()) {
          setTemplate(docSnap.data() as FormTemplate);
        } else {
          // If not found, try fetching by formId (the 3-digit one)
          const q = query(collection(db, 'form_templates'), where('formId', '==', id), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setTemplate(querySnapshot.docs[0].data() as FormTemplate);
          } else {
            console.warn('Template not found by ID or formId:', id);
          }
        }
      } catch (error) {
        console.error('Error fetching template:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || readingFile) return;
    setSubmitting(true);
    const submissionId = Math.random().toString(36).substr(2, 9);
    const path = `form_submissions/${submissionId}`;
    try {
      const submission: FormSubmission = {
        id: submissionId,
        templateId: template.id,
        formId: template.formId,
        clientId: 'public',
        clientName: formData[template.fields[0]?.id] || 'Public User',
        data: formData,
        submittedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'form_submissions', submissionId), submission);
      setSubmitted(true);
      toast.success(t('FormSubmittedSuccessfully') || 'Form submitted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      toast.error(getFriendlyErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500">
        {t('FormNotFound') || 'Form not found.'}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('ThankYou') || 'Thank You!'}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('FormSubmissionReceived') || 'Your submission has been received.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-xl w-full overflow-hidden"
      >
        {template.headerImage && (
          <div className="w-full h-48 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <img 
              src={template.headerImage} 
              alt="Header" 
              className="max-w-full max-h-full object-contain" 
              referrerPolicy="no-referrer" 
            />
          </div>
        )}
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{template.title}</h1>
            <p className="text-slate-500 dark:text-slate-400">{template.description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {[...template.fields]
              .sort((a, b) => (a.type === 'file' ? 1 : b.type === 'file' ? -1 : 0))
              .map(field => (
                <div key={`public-form-field-${field.id}`} className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px]"
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">{t('SelectOption') || 'Select an option'}</option>
                    {field.options?.map((opt, i) => (
                      <option key={`form-opt-${opt}-${i}`} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'file' ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="file"
                        required={field.required && !formData[field.id]}
                        disabled={readingFile === field.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Firestore document limit is 1MB. Base64 adds ~33% overhead.
                            // Limit to 700KB to be safe.
                            if (file.size > 700 * 1024) {
                              toast.error(t('FileTooLarge') || 'File is too large. Max size is 700KB.');
                              e.target.value = '';
                              return;
                            }
                            setReadingFile(field.id);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({ 
                                ...formData, 
                                [field.id]: {
                                  name: file.name,
                                  type: file.type,
                                  size: file.size,
                                  data: reader.result as string
                                }
                              });
                              setReadingFile(null);
                            };
                            reader.onerror = () => {
                              toast.error(t('ErrorReadingFile') || 'Error reading file.');
                              setReadingFile(null);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400 disabled:opacity-50"
                      />
                      {readingFile === field.id && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center rounded-xl">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        </div>
                      )}
                    </div>
                    {formData[field.id] && (
                      <div className="text-xs text-slate-500 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <FileUp className="w-3 h-3 text-blue-500" />
                        <span className="truncate flex-1">{formData[field.id].name}</span>
                        <span className="text-[10px] opacity-60">({(formData[field.id].size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newFormData = { ...formData };
                            delete newFormData[field.id];
                            setFormData(newFormData);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type={['first_name', 'last_name'].includes(field.type) ? 'text' : field.type}
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting || !!readingFile}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('SubmitForm') || 'Submit Form'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const SortableField = ({ 
  field, 
  onRemove, 
  onUpdate, 
  t 
}: { 
  field: any, 
  onRemove: (id: string) => void, 
  onUpdate: (id: string, updates: any) => void,
  t: any
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const [isCustomType, setIsCustomType] = useState(!['text', 'number', 'email', 'date', 'textarea', 'select', 'checkbox', 'file', 'first_name', 'last_name'].includes(field.type));

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group"
    >
      <div className="flex items-center gap-2 mb-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        <button
          onClick={() => onRemove(field.id)}
          className="text-slate-400 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('FieldLabel')}</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate(field.id, { label: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('FieldType')}</label>
          <div className="space-y-2">
            <select
              value={isCustomType ? 'custom' : field.type}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') {
                  setIsCustomType(true);
                  onUpdate(field.id, { type: '' });
                } else {
                  setIsCustomType(false);
                  onUpdate(field.id, { type: val });
                }
              }}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
              <option value="date">Date</option>
              <option value="textarea">Textarea</option>
              <option value="select">Select</option>
              <option value="checkbox">Checkbox</option>
              <option value="file">File Upload</option>
              <option value="first_name">First Name</option>
              <option value="last_name">Last Name</option>
              <option value="custom">Custom Type...</option>
            </select>
            {isCustomType && (
              <input
                type="text"
                placeholder="Enter custom type (e.g. url, tel)"
                value={field.type}
                onChange={(e) => onUpdate(field.id, { type: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            )}
          </div>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('FieldRequired')}</span>
          </label>
        </div>
      </div>

      {field.type === 'select' && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('Options')} (comma separated)</label>
          <input
            type="text"
            value={field.options?.join(', ') || ''}
            onChange={(e) => onUpdate(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="Option 1, Option 2, Option 3"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>
      )}
    </div>
  );
};

const TemplateEditor = ({ template, onSave, onCancel }: {
  template: FormTemplate,
  onSave: (t: FormTemplate) => void,
  onCancel: () => void
}) => {
  const { t } = useTranslation();
  const [editedTemplate, setEditedTemplate] = useState<FormTemplate>({ ...template });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditedTemplate((prev) => {
        const oldIndex = prev.fields.findIndex((f) => f.id === active.id);
        const newIndex = prev.fields.findIndex((f) => f.id === over.id);

        return {
          ...prev,
          fields: arrayMove(prev.fields, oldIndex, newIndex),
        };
      });
    }
  };

  const addField = () => {
    const newField = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'New Field',
      type: 'text',
      required: false
    };
    setEditedTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
  };

  const removeField = (id) => {
    setEditedTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }));
  };

  const updateField = (id, updates) => {
    setEditedTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('EditTemplate')}: {template.title}</h2>
          <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border-2 border-blue-100 dark:border-blue-800">
            {t('FormId')}: {template.formId}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={() => onSave(editedTemplate)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {t('Save')}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('Title')}</label>
            <input
              type="text"
              value={editedTemplate.title}
              onChange={(e) => setEditedTemplate(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('Description')}</label>
            <input
              type="text"
              value={editedTemplate.description}
              onChange={(e) => setEditedTemplate(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('HeaderImage') || 'Header Image'}</label>
          <div className="flex items-start gap-4">
            {editedTemplate.headerImage && (
              <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={editedTemplate.headerImage} alt="Header" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  onClick={() => setEditedTemplate(prev => ({ ...prev, headerImage: undefined }))}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex-1">
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-900/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Camera className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-xs text-slate-500">{t('UploadHeaderImage') || 'Upload Header Image'}</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setEditedTemplate(prev => ({ ...prev, headerImage: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('Fields')}</h3>
            <button
              onClick={addField}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('AddFormField')}
            </button>
          </div>

          <div className="space-y-4">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={editedTemplate.fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {editedTemplate.fields.map((field) => (
                  <SortableField 
                    key={`sortable-field-${field.id}`} 
                    field={field} 
                    onRemove={removeField} 
                    onUpdate={updateField} 
                    t={t} 
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
};

const Reminders = ({ userId, isAdmin }: { userId: string, isAdmin: boolean }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReminder, setNewReminder] = useState<Partial<Reminder>>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().slice(0, 16),
    priority: 'medium',
    status: 'pending'
  });

  useEffect(() => {
    if (!profile) return;
    const q = isAdmin 
      ? query(collection(db, 'reminders'), orderBy('dueDate', 'asc'))
      : query(collection(db, 'reminders'), where('assignedToId', '==', userId), orderBy('dueDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reminders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isAdmin]);

  const handleAddReminder = async () => {
    if (!newReminder.title || !newReminder.dueDate) {
      toast.error(t('PleaseFillRequiredFields') || 'Please fill in all required fields.');
      return;
    }

    try {
      const id = Math.random().toString(36).substr(2, 9);
      const reminder: Reminder = {
        id,
        creatorId: userId,
        assignedToId: userId, // Default to self
        title: newReminder.title!,
        description: newReminder.description,
        dueDate: new Date(newReminder.dueDate!).toISOString(),
        status: 'pending',
        priority: newReminder.priority as any,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'reminders', id), reminder);
      setShowAddModal(false);
      setNewReminder({
        title: '',
        description: '',
        dueDate: new Date().toISOString().slice(0, 16),
        priority: 'medium',
        status: 'pending'
      });
      toast.success(t('ReminderAdded') || 'Reminder added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reminders');
    }
  };

  const toggleStatus = async (reminder: Reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        status: reminder.status === 'pending' ? 'completed' : 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reminders/${reminder.id}`);
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
      toast.success(t('ReminderDeleted') || 'Reminder deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reminders/${id}`);
    }
  };

  if (loading) return <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="text-blue-500" />
          {t('TaskReminders') || 'Task Reminders'}
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          {t('AddTask') || 'Add Task'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reminders.map((reminder) => (
          <motion.div
            key={`reminder-task-${reminder.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl border transition-all ${
              reminder.status === 'completed' 
                ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-4">
              <button
                onClick={() => toggleStatus(reminder)}
                className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  reminder.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                }`}
              >
                {reminder.status === 'completed' && <Check size={14} />}
              </button>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-bold text-slate-900 dark:text-white ${reminder.status === 'completed' ? 'line-through' : ''}`}>
                      {reminder.title}
                    </h3>
                    {reminder.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{reminder.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      reminder.priority === 'high' ? 'bg-red-100 text-red-600' :
                      reminder.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {t(reminder.priority)}
                    </span>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {safeFormat(reminder.dueDate, 'MMM d, h:mm a')}
                    {new Date(reminder.dueDate) < new Date() && reminder.status === 'pending' && (
                      <span className="text-red-500 font-bold ml-2">({t('Overdue') || 'Overdue'})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {reminders.length === 0 && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Bell size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('NoTasksFound') || 'No tasks found. Add one to get started!'}</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('AddNewTask') || 'Add New Task'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('TaskTitle') || 'Task Title'}</label>
                <input
                  type="text"
                  value={newReminder.title}
                  onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 dark:text-white"
                  placeholder={t('EnterTaskTitle') || 'Enter task title...'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('Description')}</label>
                <textarea
                  value={newReminder.description}
                  onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 dark:text-white min-h-[100px]"
                  placeholder={t('EnterDescription') || 'Enter description...'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('DueDate')}</label>
                  <input
                    type="datetime-local"
                    value={newReminder.dueDate}
                    onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('Priority')}</label>
                  <select
                    value={newReminder.priority}
                    onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 dark:text-white"
                  >
                    <option value="low">{t('Low')}</option>
                    <option value="medium">{t('Medium')}</option>
                    <option value="high">{t('High')}</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddReminder}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
              >
                {t('SaveTask') || 'Save Task'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const TeamPortalSystem = () => {
  const { t } = useTranslation();
  const { isAdmin, profile, user, canEdit } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewHireModal, setShowNewHireModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);
  const [deactivateStep, setDeactivateStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [deactivatedSearchQuery, setDeactivatedSearchQuery] = useState('');
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reminders'>('dashboard');

  useEffect(() => {
    const hash = window.location.hash.split('#')[2];
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = isAdmin 
      ? query(collection(db, 'timeOffRequests'), where('teamLeaderId', '==', user.uid))
      : query(collection(db, 'timeOffRequests'), where('employeeId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimeOffRequest));
      setTimeOffRequests(requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'timeOffRequests');
    });
    return () => unsubscribe();
  }, [isAdmin, user]);

  const handleApproveRequest = async (request: TimeOffRequest) => {
    try {
      const empDoc = await getDoc(doc(db, 'users', request.employeeId));
      if (!empDoc.exists()) return;
      const empData = empDoc.data() as UserProfile;
      
      const balanceUpdates: any = {};
      if (request.type === 'sick') balanceUpdates.sickHoursBalance = (empData.sickHoursBalance || 0) - request.amount;
      if (request.type === 'vacation') balanceUpdates.vacationHoursBalance = (empData.vacationHoursBalance || 0) - request.amount;
      if (request.type === 'pto') balanceUpdates.ptoHoursBalance = (empData.ptoHoursBalance || 0) - request.amount;
      if (request.type === 'errands') balanceUpdates.weeklyErrandsHoursBalance = (empData.weeklyErrandsHoursBalance || 0) - request.amount;

      await updateDoc(doc(db, 'timeOffRequests', request.id), { 
        status: 'approved',
        audit: getAuditMetadata(profile, 'Approved time-off request')
      });
      await logGlobalAudit(profile, 'Approve Time Off', 'system', `Approved ${request.type} for ${request.employeeName}`, request.id, request.employeeName);
      
      await updateDoc(doc(db, 'users', request.employeeId), {
        ...balanceUpdates,
        audit: getAuditMetadata(profile, 'Deducted time-off from employee balance')
      });
      
      toast.success(t('RequestApproved'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `timeOffRequests/${request.id}`);
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'timeOffRequests', requestId), {
        status: 'denied',
        audit: getAuditMetadata(profile, 'Denied time-off request')
      });
      const req = timeOffRequests.find(r => r.id === requestId);
      if (req) {
        await logGlobalAudit(profile, 'Deny Time Off', 'system', `Denied ${req.type} for ${req.employeeName}`, req.id, req.employeeName);
      }
      toast.success(t('RequestDenied'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `timeOffRequests/${requestId}`);
    }
  };

  const handleRequestTimeOff = async (type: TimeOffRequest['type'], amount: number, startDate: string, endDate: string, reason: string) => {
    if (!user || !profile) return;
    
    // Balance check
    let currentBalance = 0;
    if (type === 'sick') currentBalance = profile.sickHoursBalance || 0;
    if (type === 'vacation') currentBalance = profile.vacationHoursBalance || 0;
    if (type === 'pto') currentBalance = profile.ptoHoursBalance || 0;
    if (type === 'errands') currentBalance = profile.weeklyErrandsHoursBalance || 0;

    if (amount > currentBalance) {
      toast.error(t('InsufficientBalance'));
      return;
    }

    setRequestLoading(true);
    try {
      await addDoc(collection(db, 'timeOffRequests'), {
        employeeId: user.uid,
        employeeName: profile.displayName,
        teamLeaderId: profile.teamLeaderId,
        type,
        amount,
        startDate,
        endDate,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      toast.success(t('RequestSubmitted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'timeOffRequests');
    } finally {
      setRequestLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    if (!searchQuery.trim()) return activeEmployees;
    const query = searchQuery.toLowerCase();
    return activeEmployees.filter(emp => {
      const searchableFields = [
        emp.employeeFirstName,
        emp.employeeMiddleName,
        emp.employeeLastName,
        emp.employeeDisplayName,
        emp.firstName,
        emp.middleName,
        emp.lastName,
        emp.displayName,
        emp.email,
        emp.employeeDob,
        emp.dob,
        emp.department,
        emp.jobTitle,
        emp.employeePersonalPhone,
        emp.personalPhone,
        emp.employeeStreetAddress,
        emp.streetAddress,
        emp.employeeCity,
        emp.city,
        emp.employeeStateProvince,
        emp.stateProvince,
        emp.employeeZipCode,
        emp.zipCode,
        emp.employeeCountry,
        emp.country,
        emp.taxId,
        emp.hireDate,
        emp.emergencyContactFirstName,
        emp.emergencyContactLastName,
        emp.emergencyContactPhone,
        emp.emergencyContactEmail
      ];
      return searchableFields.some(field => 
        field?.toLowerCase().includes(query)
      );
    });
  }, [employees, searchQuery]);

  const filteredDeactivatedEmployees = useMemo(() => {
    const deactivatedEmployees = employees.filter(emp => emp.status !== 'active');
    if (!deactivatedSearchQuery.trim()) return deactivatedEmployees;
    const query = deactivatedSearchQuery.toLowerCase();
    return deactivatedEmployees.filter(emp => {
      const searchableFields = [
        emp.employeeDisplayName,
        emp.displayName,
        emp.email,
        emp.department,
        emp.jobTitle
      ];
      return searchableFields.some(field => 
        field?.toLowerCase().includes(query)
      );
    });
  }, [employees, deactivatedSearchQuery]);

  const copyLoginLink = () => {
    const loginUrl = `${window.location.origin}/#/employee-login`;
    navigator.clipboard.writeText(loginUrl);
    toast.success(t('LoginLinkCopied'));
  };

  const handleTogglePortalAccess = async (employee: UserProfile) => {
    if (employee.role === 'admin') {
      toast.error(t('CannotBlockAdmin'));
      return;
    }
    const newStatus = employee.status === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'users', employee.uid), {
        status: newStatus,
        audit: getAuditMetadata(profile, `Changed employee portal access to ${newStatus}`)
      });
      toast.success(t(newStatus === 'active' ? 'PortalReactivated' : 'PortalDeactivated'));
      setDeactivateStep(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${employee.uid}`);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'), where('isEmployee', '==', true), where('teamLeaderId', '==', user?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setEmployees(emps);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, [isAdmin, user?.uid]);

  const handleClockIn = async () => {
    if (!user || !profile) return;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const time = format(now, 'HH:mm');
    
    const status = isAfter(now, addHours(startOfDay(now), 9)) ? 'late' : 'on-time';
    
    const newHistory = [...(profile.clockInHistory || []), {
      date: today,
      clockIn: time,
      status
    }];

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        clockInHistory: newHistory,
        audit: getAuditMetadata(profile, 'Employee clocked in')
      });
      toast.success(t('ClockInSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleClockOut = async () => {
    if (!user || !profile || !profile.clockInHistory) return;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const time = format(now, 'HH:mm');
    
    const newHistory = profile.clockInHistory.map(entry => {
      if (entry.date === today && !entry.clockOut) {
        return { ...entry, clockOut: time };
      }
      return entry;
    });

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        clockInHistory: newHistory,
        audit: getAuditMetadata(profile, 'Employee clocked out')
      });
      toast.success(t('ClockOutSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (isAdmin) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('HRDashboard')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('EmployeeManagementDesc')}</p>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t('Dashboard')}
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === 'reminders'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Bell size={16} />
              {t('Reminders')}
            </button>
          </div>
        </div>

        {activeTab === 'reminders' ? (
          <Reminders userId={user?.uid || ''} isAdmin={true} />
        ) : (
          <>
            <div className="flex justify-between items-center">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={20} />
                <input
                  type="text"
                  placeholder={t('SearchEmployees')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={copyLoginLink}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm border border-slate-100 dark:border-slate-700"
                >
                  <Copy size={20} />
                  {t('CopyLoginLink')}
                </button>
                {canEdit && (
                  <button 
                    onClick={() => setShowNewHireModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 self-start"
                  >
                    <UserPlus size={20} />
                    {t('CreateNewHire')}
                  </button>
                )}
              </div>
            </div>

        <div className="space-y-8">
            {/* Deactivated Employees Section */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX size={20} className="text-red-500" />
                {t('DeactivatedEmployees')}
              </h2>
              <p className="text-xs text-slate-500">{t('ManageDeactivatedEmployeesDesc') || 'Manage and reactivate deactivated employee profiles.'}</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('SearchDeactivatedEmployees')}
                value={deactivatedSearchQuery}
                onChange={(e) => setDeactivatedSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">{t('EmployeeName')}</th>
                  <th className="px-6 py-4 font-bold">{t('Department')}</th>
                  <th className="px-6 py-4 font-bold">{t('Status')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredDeactivatedEmployees.map((emp) => (
                  <tr key={`hr-deactivated-emp-${emp.uid}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer" onClick={() => navigate(`/portal/team-portal/employee/${emp.uid}`)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold">
                          {(emp.employeeDisplayName || emp.displayName).charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{emp.employeeDisplayName || emp.displayName}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{emp.department || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase">
                        {t('Blocked')}
                      </span>
                    </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/portal/team-portal/employee/${emp.uid}`);
                              }}
                              className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                            >
                              {t('ViewProfile')}
                            </button>
                        {canEdit && (
                          <button 
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setDeactivateStep(1);
                            }}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all"
                          >
                            {t('Reactivate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDeactivatedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                      {t('NoDeactivatedEmployeesFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showNewHireModal && (
          <NewHireModal 
            isOpen={showNewHireModal} 
            onClose={() => setShowNewHireModal(false)} 
            teamLeaderId={user?.uid || ''} 
          />
        )}
          </div>
        </>
        )}
      </div>
    );
  }

  // Employee View
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntry = profile?.clockInHistory?.find(h => h.date === today);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-sm font-bold">
              <Briefcase size={16} />
              {profile?.jobTitle || t('EmployeePortal')}
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              {t('WelcomeBack')},<br />
              <span className="text-blue-200">{profile?.employeeDisplayName || profile?.displayName}</span>
            </h1>
            <div className="flex items-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20 w-fit mx-auto md:mx-0">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {t('Dashboard')}
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'reminders'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Bell size={16} />
                {t('Reminders')}
              </button>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/20 flex flex-col items-center gap-6 min-w-[240px]">
            <div className="text-center">
              <div className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">{t('CurrentTime')}</div>
              <div className="text-4xl font-black tabular-nums">{format(new Date(), 'HH:mm')}</div>
            </div>
            
            {!todayEntry ? (
              <button 
                onClick={handleClockIn}
                className="w-full bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-2xl font-black transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              >
                <Clock size={24} />
                {t('ClockIn')}
              </button>
            ) : !todayEntry.clockOut ? (
              <button 
                onClick={handleClockOut}
                className="w-full bg-rose-500 text-white hover:bg-rose-600 px-8 py-4 rounded-2xl font-black transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              >
                <LogOut size={24} />
                {t('ClockOut')}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle size={20} />
                {t('ShiftCompleted')}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'reminders' ? (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
          <Reminders userId={user?.uid || ''} isAdmin={false} />
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div id="request-time-off" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-100 dark:border-blue-800">
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">{t('SickDays')}</div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{profile?.sickHoursBalance || 0}h</div>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">{t('VacationDays')}</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{profile?.vacationHoursBalance || 0}h</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
              <div className="text-[10px] font-bold text-purple-400 uppercase mb-1">{t('PTO')}</div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{profile?.ptoHoursBalance || 0}h</div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">
              <div className="text-[10px] font-bold text-amber-400 uppercase mb-1">{t('WeeklyErrands')}</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{profile?.weeklyErrandsHoursBalance || 0}h</div>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleRequestTimeOff(
              formData.get('type') as TimeOffRequest['type'],
              Number(formData.get('amount')),
              formData.get('startDate') as string,
              formData.get('endDate') as string,
              formData.get('reason') as string
            );
            (e.target as HTMLFormElement).reset();
          }} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('Type')}</label>
                <select name="type" required className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold">
                  <option value="sick">{t('SickDays')}</option>
                  <option value="vacation">{t('VacationDays')}</option>
                  <option value="pto">{t('PTO')}</option>
                  <option value="errands">{t('WeeklyErrands')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('Amount')}</label>
                <input name="amount" type="number" step="0.5" required className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold" placeholder="1.0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('StartDate')}</label>
                <input name="startDate" type="date" required className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('EndDate')}</label>
                <input name="endDate" type="date" required className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('Reason')}</label>
              <textarea name="reason" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold" rows={2} placeholder={t('Reason')}></textarea>
            </div>
            <button 
              type="submit"
              disabled={requestLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {requestLoading ? <RefreshCw className="animate-spin mx-auto" size={24} /> : t('SubmitRequest')}
            </button>
          </form>
        </div>

        <div id="time-off-requests" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {timeOffRequests.length > 0 ? timeOffRequests.map((req) => (
              <div key={`user-time-off-req-${req.id}`} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">{t(req.type === 'sick' ? 'SickDays' : req.type === 'vacation' ? 'VacationDays' : req.type === 'pto' ? 'PTO' : 'WeeklyErrands')}</div>
                    <div className="text-xs text-slate-500">{req.startDate} - {req.endDate} ({req.amount} {req.type === 'errands' ? 'h' : 'd'})</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 
                    req.status === 'denied' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {t(req.status === 'approved' ? 'Approved' : req.status === 'denied' ? 'Denied' : 'Pending')}
                  </span>
                </div>
                {req.reason && <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{req.reason}"</p>}
              </div>
            )) : (
              <p className="text-slate-400 italic text-center py-8">{t('NoRequestsFound')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div id="my-benefits" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {profile?.benefits?.map((benefit, i) => (
              <div key={`user-benefit-${profile.uid}-${i}`} className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Check size={16} />
                </div>
                <span className="font-bold text-purple-900 dark:text-purple-100">{benefit}</span>
              </div>
            )) || <p className="text-slate-400 italic">{t('NoBenefitsAssigned')}</p>}
          </div>
        </div>

        <div id="my-documents" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          <div className="space-y-3">
            {profile?.employeeFiles?.filter(f => f.visibleToEmployee).map((file) => (
              <div key={`user-employee-file-${file.id}`} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-blue-200 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileIcon size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">{file.name}</span>
                </div>
                <Download size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            )) || <p className="text-slate-400 italic">{t('NoDocumentsShared')}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div id="pay-statements" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard size={24} className="text-blue-600" />
              {t('PayStatements')}
            </h3>
          </div>
          <div className="space-y-3">
            <p className="text-slate-400 italic text-center py-8">{t('NoPayStatementsFound')}</p>
          </div>
        </div>

        <div id="tax-documents" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={24} className="text-blue-600" />
              {t('TaxDocuments')}
            </h3>
          </div>
          <div className="space-y-3">
            <p className="text-slate-400 italic text-center py-8">{t('NoTaxDocumentsFound')}</p>
          </div>
        </div>
      </div>

      <div id="attendance-history" className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
        <div className="space-y-3">
          {profile?.clockInHistory?.slice().reverse().map((entry, i) => (
            <div key={`clock-entry-${profile.uid}-${entry.date}-${i}`} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold text-slate-500">{entry.date}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">{entry.clockIn}</span>
                  <span className="text-slate-300">-</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{entry.clockOut || '--:--'}</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                entry.status === 'on-time' ? 'bg-emerald-100 text-emerald-600' : 
                entry.status === 'late' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
              }`}>
                {t(entry.status === 'on-time' ? 'OnTime' : entry.status === 'late' ? 'Late' : 'Absent')}
              </span>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

const NewHireModal = ({ isOpen, onClose, teamLeaderId }: { isOpen: boolean, onClose: () => void, teamLeaderId: string }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    department: '',
    jobTitle: '',
    personalPhone: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    zipCode: '',
    country: '',
    taxId: '',
    hireDate: format(new Date(), 'yyyy-MM-dd'),
    emergencyContactFirstName: '',
    emergencyContactLastName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('PasswordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      let uid = '';
      let isExistingUser = false;

      // Check if user already exists in Firestore (to get their UID if they exist in Auth)
      const q = query(collection(db, 'users'), where('email', '==', formData.email.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        uid = querySnapshot.docs[0].id;
        isExistingUser = true;
      } else {
        try {
          // Create Auth user using secondary app to avoid logging out current admin
          const secondaryApp = initializeApp(firebaseConfigExport, 'Secondary');
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
          const user = userCredential.user;
          uid = user.uid;
          
          // Update Auth profile
          await updateProfile(user, { displayName: `${formData.firstName} ${formData.lastName}` });
          
          // Clean up secondary app
          await secondaryAuth.signOut();
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // This means they are in Auth but not in Firestore 'users' collection.
            // We can't easily get the UID here without Admin SDK or signing in.
            // But in this app, every Auth user should have a 'users' doc.
            toast.error('This email is already in use in Authentication but no profile was found. Please contact support.');
            setLoading(false);
            return;
          }
          throw authError;
        }
      }

      const newHireProfile: any = {
        uid: uid,
        email: formData.email,
        isEmployee: true,
        employeeDisplayName: `${formData.firstName} ${formData.lastName}`,
        employeeFirstName: formData.firstName,
        employeeMiddleName: formData.middleName,
        employeeLastName: formData.lastName,
        employeePersonalPhone: formData.personalPhone,
        employeeDob: formData.dob,
        status: 'active',
        activeFlag: 'green',
        teamLeaderId: teamLeaderId,
        department: formData.department,
        jobTitle: formData.jobTitle,
        employeeStreetAddress: formData.streetAddress,
        employeeCity: formData.city,
        employeeStateProvince: formData.stateProvince,
        employeeZipCode: formData.zipCode,
        employeeCountry: formData.country,
        taxId: formData.taxId,
        hireDate: formData.hireDate,
        sickHoursBalance: calculateProratedBalance(60, formData.hireDate),
        vacationHoursBalance: calculateProratedBalance(96, formData.hireDate),
        ptoHoursBalance: calculateProratedBalance(72, formData.hireDate),
        lastYearlyAllocation: new Date().getFullYear(),
        emergencyContactFirstName: formData.emergencyContactFirstName,
        emergencyContactLastName: formData.emergencyContactLastName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        benefits: ['Health Insurance', '401k', 'Paid Time Off'],
        clockInHistory: [],
        employeeFiles: [
          { id: '1', name: 'Employee Handbook.pdf', url: '#', type: 'pdf', uploadedAt: new Date().toISOString(), visibleToEmployee: true },
          { id: '2', name: 'Code of Conduct.pdf', url: '#', type: 'pdf', uploadedAt: new Date().toISOString(), visibleToEmployee: true }
        ],
        // Also keep legacy fields for compatibility if needed, but we'll prefer the employee-prefixed ones
        firstName: formData.firstName,
        lastName: formData.lastName,
        jobTitle_legacy: formData.jobTitle, // renamed to avoid conflict if we ever use jobTitle for clients
      };

      // If it's a new user, we also set the base fields
      if (!isExistingUser) {
        newHireProfile.role = 'employee';
        newHireProfile.displayName = `${formData.firstName} ${formData.lastName}`;
        newHireProfile.createdAt = new Date().toISOString();
      }

      await setDoc(doc(db, 'users', uid), newHireProfile, { merge: true });
      
      toast.success(t('NewHireCreated'));
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('CreateNewHire')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('FirstName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MiddleName')}</label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Quincy"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LastName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('DateOfBirth')}</label>
                    <input
                      required
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PersonalPhone')}</label>
                    <input
                      required
                      type="tel"
                      value={formData.personalPhone}
                      onChange={(e) => setFormData({...formData, personalPhone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Department')}</label>
                    <input
                      required
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Sales"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('JobTitle')}</label>
                    <input
                      required
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Account Executive"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('StreetName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({...formData, streetAddress: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('City')}</label>
                    <input
                      required
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('StateProvinceDept')}</label>
                    <input
                      required
                      type="text"
                      value={formData.stateProvince}
                      onChange={(e) => setFormData({...formData, stateProvince: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="NY"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ZipCode')}</label>
                    <input
                      required
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="10001"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Country')}</label>
                    <input
                      required
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="USA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxId')}</label>
                    <input
                      required
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('HireDate')}</label>
                    <input
                      required
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactFirstName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.emergencyContactFirstName}
                      onChange={(e) => setFormData({...formData, emergencyContactFirstName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactLastName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.emergencyContactLastName}
                      onChange={(e) => setFormData({...formData, emergencyContactLastName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactPhone')}</label>
                    <input
                      required
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="+1 (555) 111-2222"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactEmail')}</label>
                    <input
                      required
                      type="email"
                      value={formData.emergencyContactEmail}
                      onChange={(e) => setFormData({...formData, emergencyContactEmail: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PersonalEmail')}</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PortalPassword')}</label>
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ConfirmPassword')}</label>
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  {t('CreateNewHire')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const EditEmployeeModal = ({ isOpen, onClose, employee }: { isOpen: boolean, onClose: () => void, employee: UserProfile }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: employee.employeeFirstName || employee.firstName || '',
    middleName: employee.employeeMiddleName || employee.middleName || '',
    lastName: employee.employeeLastName || employee.lastName || '',
    dob: employee.employeeDob || employee.dob || '',
    department: employee.department || '',
    jobTitle: employee.jobTitle || '',
    personalPhone: employee.employeePersonalPhone || employee.personalPhone || '',
    streetAddress: employee.employeeStreetAddress || employee.streetAddress || '',
    city: employee.employeeCity || employee.city || '',
    stateProvince: employee.employeeStateProvince || employee.stateProvince || '',
    zipCode: employee.employeeZipCode || employee.zipCode || '',
    country: employee.employeeCountry || employee.country || '',
    taxId: employee.taxId || '',
    hireDate: employee.hireDate || '',
    emergencyContactFirstName: employee.emergencyContactFirstName || '',
    emergencyContactLastName: employee.emergencyContactLastName || '',
    emergencyContactPhone: employee.emergencyContactPhone || '',
    emergencyContactEmail: employee.emergencyContactEmail || '',
    email: employee.email || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedData = {
        employeeFirstName: formData.firstName,
        employeeMiddleName: formData.middleName,
        employeeLastName: formData.lastName,
        employeeDob: formData.dob,
        department: formData.department,
        jobTitle: formData.jobTitle,
        employeePersonalPhone: formData.personalPhone,
        employeeStreetAddress: formData.streetAddress,
        employeeCity: formData.city,
        employeeStateProvince: formData.stateProvince,
        employeeZipCode: formData.zipCode,
        employeeCountry: formData.country,
        taxId: formData.taxId,
        hireDate: formData.hireDate,
        emergencyContactFirstName: formData.emergencyContactFirstName,
        emergencyContactLastName: formData.emergencyContactLastName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        employeeDisplayName: `${formData.firstName} ${formData.lastName}`,
        // Update legacy fields for compatibility
        firstName: formData.firstName,
        lastName: formData.lastName,
      };
      await updateDoc(doc(db, 'users', employee.uid), updatedData);
      await logGlobalAudit(profile, profile?.uid === employee.uid ? 'Update Own Profile' : 'Update Employee Profile', 'profile', `Updated profile for ${employee.displayName}`, employee.uid, employee.displayName);
      toast.success(t('ProfileUpdated'));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${employee.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('EditProfile')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('FirstName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MiddleName')}</label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LastName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('DateOfBirth')}</label>
                    <input
                      required
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PersonalPhone')}</label>
                    <input
                      required
                      type="tel"
                      value={formData.personalPhone}
                      onChange={(e) => setFormData({...formData, personalPhone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Department')}</label>
                    <input
                      required
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('JobTitle')}</label>
                    <input
                      required
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('StreetName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({...formData, streetAddress: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('City')}</label>
                    <input
                      required
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('StateProvince')}</label>
                    <input
                      required
                      type="text"
                      value={formData.stateProvince}
                      onChange={(e) => setFormData({...formData, stateProvince: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ZipCode')}</label>
                    <input
                      required
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Country')}</label>
                    <input
                      required
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxId')}</label>
                    <input
                      required
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('HireDate')}</label>
                    <input
                      required
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactFirstName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.emergencyContactFirstName}
                      onChange={(e) => setFormData({...formData, emergencyContactFirstName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactLastName')}</label>
                    <input
                      required
                      type="text"
                      value={formData.emergencyContactLastName}
                      onChange={(e) => setFormData({...formData, emergencyContactLastName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactPhone')}</label>
                    <input
                      required
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmergencyContactEmail')}</label>
                    <input
                      required
                      type="email"
                      value={formData.emergencyContactEmail}
                      onChange={(e) => setFormData({...formData, emergencyContactEmail: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PersonalEmail')}</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  {t('Save')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const FolderModal = ({ isOpen, onClose, onCreate }: { isOpen: boolean, onClose: () => void, onCreate: (name: string) => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{t('CreateFolder')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('FolderName')}</label>
                  <input
                    required
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder={t('NewFolder')}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  {t('CreateFolder')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const RootRedirect = () => {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? <Navigate to="/admin" /> : <Navigate to="/portal" />;
};

const NewContractorModal = ({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess?: (contractor: UserProfile) => void }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    contractorType: 'individual' as 'company' | 'individual',
    // Common fields
    serviceType: '',
    serviceStartDate: format(new Date(), 'yyyy-MM-dd'),
    serviceEndDate: '',
    serviceFee: '',
    otherFeesDescription: '',
    note: '',
    // Company fields
    legalCompanyName: '',
    companyTaxId: '',
    taxIdType: '',
    companyLegalStructure: '',
    membersOrShareholders: '',
    bestPhoneNumber: '',
    bestEmailAddress: '',
    companyLegalAddress: '',
    companyLegalAddressStreet: '',
    companyLegalAddressCity: '',
    companyLegalAddressState: '',
    companyLegalAddressZip: '',
    otherCompanyAddress: '',
    otherCompanyAddressStreet: '',
    otherCompanyAddressCity: '',
    otherCompanyAddressState: '',
    otherCompanyAddressZip: '',
    companyRegisteredRegion: '',
    legalRepresentativeName: '',
    legalRepresentativePhone: '',
    legalRepresentativeEmail: '',
    projectManagerName: '',
    projectManagerPhone: '',
    projectManagerEmail: '',
    // Individual fields
    legalName: '',
    taxIdentification: '',
    currentAddress: '',
    currentAddressStreet: '',
    currentAddressCity: '',
    currentAddressState: '',
    currentAddressZip: '',
    otherAddress: '',
    otherAddressStreet: '',
    otherAddressCity: '',
    otherAddressState: '',
    otherAddressZip: '',
    birthRegion: '',
    mainSpecialization: '',
    serviceFeeDescription: '',
    // Legacy/Internal fields
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error(t('PasswordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      let uid = '';
      const emailToUse = formData.contractorType === 'company' ? formData.bestEmailAddress : formData.bestEmailAddress || formData.email;
      
      if (!emailToUse) {
        throw new Error('Email is required');
      }

      const q = query(collection(db, 'users'), where('email', '==', emailToUse.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        uid = querySnapshot.docs[0].id;
      } else {
        const secondaryApp = initializeApp(firebaseConfigExport, 'SecondaryContractor');
        const secondaryAuth = getAuth(secondaryApp);
        const displayName = formData.contractorType === 'company' ? formData.legalCompanyName : formData.legalName;
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, formData.password || Math.random().toString(36).slice(-8));
        uid = userCredential.user.uid;
        await updateProfile(userCredential.user, { displayName });
        await secondaryAuth.signOut();
      }

      const contractorProfile: any = {
        uid,
        email: emailToUse,
        isContractor: true,
        contractorType: formData.contractorType,
        status: 'active',
        activeFlag: 'green',
        role: 'contractor',
        displayName: formData.contractorType === 'company' ? formData.legalCompanyName : formData.legalName,
        createdAt: new Date().toISOString(),
        ...formData
      };

      // Clean up internal fields
      delete contractorProfile.password;
      delete contractorProfile.firstName;
      delete contractorProfile.lastName;

      await setDoc(doc(db, 'users', uid), contractorProfile, { merge: true });
      toast.success(t('NewContractorCreated'));
      if (onSuccess) {
        onSuccess(contractorProfile as UserProfile);
      }
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('CreateContractor')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TypeOfContractor')}</label>
                  <select
                    value={formData.contractorType}
                    onChange={(e) => setFormData({...formData, contractorType: e.target.value as 'company' | 'individual'})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="individual">{t('Individual')}</option>
                    <option value="company">{t('Company')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {formData.contractorType === 'company' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalCompanyName')}</label>
                        <input required type="text" value={formData.legalCompanyName} onChange={(e) => setFormData({...formData, legalCompanyName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyTaxIdEIN')}</label>
                        <input required type="text" value={formData.companyTaxId} onChange={(e) => setFormData({...formData, companyTaxId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxIdType')}</label>
                        <input type="text" value={formData.taxIdType} onChange={(e) => setFormData({...formData, taxIdType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyLegalStructure')}</label>
                        <input type="text" value={formData.companyLegalStructure} onChange={(e) => setFormData({...formData, companyLegalStructure: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MembersOrShareholders')}</label>
                        <input type="text" value={formData.membersOrShareholders} onChange={(e) => setFormData({...formData, membersOrShareholders: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestPhoneNumber')}</label>
                        <input required type="text" value={formData.bestPhoneNumber} onChange={(e) => setFormData({...formData, bestPhoneNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestEmailAddress')}</label>
                        <input required type="email" value={formData.bestEmailAddress} onChange={(e) => setFormData({...formData, bestEmailAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyLegalAddress')}</label>
                        <input type="text" value={formData.companyLegalAddress} onChange={(e) => setFormData({...formData, companyLegalAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.companyLegalAddressStreet} onChange={(e) => setFormData({...formData, companyLegalAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.companyLegalAddressCity} onChange={(e) => setFormData({...formData, companyLegalAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.companyLegalAddressState} onChange={(e) => setFormData({...formData, companyLegalAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.companyLegalAddressZip} onChange={(e) => setFormData({...formData, companyLegalAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherCompanyAddress')}</label>
                        <input type="text" value={formData.otherCompanyAddress} onChange={(e) => setFormData({...formData, otherCompanyAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.otherCompanyAddressStreet} onChange={(e) => setFormData({...formData, otherCompanyAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.otherCompanyAddressCity} onChange={(e) => setFormData({...formData, otherCompanyAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.otherCompanyAddressState} onChange={(e) => setFormData({...formData, otherCompanyAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.otherCompanyAddressZip} onChange={(e) => setFormData({...formData, otherCompanyAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyRegisteredRegion')}</label>
                        <input type="text" value={formData.companyRegisteredRegion} onChange={(e) => setFormData({...formData, companyRegisteredRegion: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceType')}</label>
                        <input type="text" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceStartDate')}</label>
                        <input type="date" value={formData.serviceStartDate} onChange={(e) => setFormData({...formData, serviceStartDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceEndDate')}</label>
                        <input type="date" value={formData.serviceEndDate} onChange={(e) => setFormData({...formData, serviceEndDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativeName')}</label>
                        <input type="text" value={formData.legalRepresentativeName} onChange={(e) => setFormData({...formData, legalRepresentativeName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativePhone')}</label>
                        <input type="text" value={formData.legalRepresentativePhone} onChange={(e) => setFormData({...formData, legalRepresentativePhone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativeEmail')}</label>
                        <input type="email" value={formData.legalRepresentativeEmail} onChange={(e) => setFormData({...formData, legalRepresentativeEmail: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerName')}</label>
                        <input type="text" value={formData.projectManagerName} onChange={(e) => setFormData({...formData, projectManagerName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerPhone')}</label>
                        <input type="text" value={formData.projectManagerPhone} onChange={(e) => setFormData({...formData, projectManagerPhone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerEmail')}</label>
                        <input type="email" value={formData.projectManagerEmail} onChange={(e) => setFormData({...formData, projectManagerEmail: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceFee')}</label>
                        <input type="text" value={formData.serviceFee} onChange={(e) => setFormData({...formData, serviceFee: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherFeesDescription')}</label>
                        <input type="text" value={formData.otherFeesDescription} onChange={(e) => setFormData({...formData, otherFeesDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Note')}</label>
                        <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalName')}</label>
                        <input required type="text" value={formData.legalName} onChange={(e) => setFormData({...formData, legalName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxIdentificationSSN')}</label>
                        <input required type="text" value={formData.taxIdentification} onChange={(e) => setFormData({...formData, taxIdentification: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestPhoneNumber')}</label>
                        <input required type="text" value={formData.bestPhoneNumber} onChange={(e) => setFormData({...formData, bestPhoneNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestEmailAddress')}</label>
                        <input required type="email" value={formData.bestEmailAddress} onChange={(e) => setFormData({...formData, bestEmailAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CurrentAddress')}</label>
                        <input type="text" value={formData.currentAddress} onChange={(e) => setFormData({...formData, currentAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.currentAddressStreet} onChange={(e) => setFormData({...formData, currentAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.currentAddressCity} onChange={(e) => setFormData({...formData, currentAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.currentAddressState} onChange={(e) => setFormData({...formData, currentAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.currentAddressZip} onChange={(e) => setFormData({...formData, currentAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherAddress')}</label>
                        <input type="text" value={formData.otherAddress} onChange={(e) => setFormData({...formData, otherAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.otherAddressStreet} onChange={(e) => setFormData({...formData, otherAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.otherAddressCity} onChange={(e) => setFormData({...formData, otherAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.otherAddressState} onChange={(e) => setFormData({...formData, otherAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.otherAddressZip} onChange={(e) => setFormData({...formData, otherAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BirthRegion')}</label>
                        <input type="text" value={formData.birthRegion} onChange={(e) => setFormData({...formData, birthRegion: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceType')}</label>
                        <input type="text" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MainSpecialization')}</label>
                        <input type="text" value={formData.mainSpecialization} onChange={(e) => setFormData({...formData, mainSpecialization: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceStartDate')}</label>
                        <input type="date" value={formData.serviceStartDate} onChange={(e) => setFormData({...formData, serviceStartDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceEndDate')}</label>
                        <input type="date" value={formData.serviceEndDate} onChange={(e) => setFormData({...formData, serviceEndDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceFeeDescription')}</label>
                        <input type="text" value={formData.serviceFeeDescription} onChange={(e) => setFormData({...formData, serviceFeeDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherFeesDescription')}</label>
                        <input type="text" value={formData.otherFeesDescription} onChange={(e) => setFormData({...formData, otherFeesDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Note')}</label>
                        <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]" />
                      </div>
                    </>
                  )}
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  {t('CreateContractor')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const EditContractorModal = ({ isOpen, onClose, contractor }: { isOpen: boolean, onClose: () => void, contractor: UserProfile }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    contractorType: contractor.contractorType || 'individual' as 'company' | 'individual',
    // Common fields
    serviceType: contractor.serviceType || '',
    serviceStartDate: contractor.serviceStartDate || '',
    serviceEndDate: contractor.serviceEndDate || '',
    serviceFee: contractor.serviceFee || '',
    otherFeesDescription: contractor.otherFeesDescription || '',
    note: contractor.note || '',
    // Company fields
    legalCompanyName: contractor.legalCompanyName || '',
    companyTaxId: contractor.companyTaxId || '',
    taxIdType: contractor.taxIdType || '',
    companyLegalStructure: contractor.companyLegalStructure || '',
    membersOrShareholders: contractor.membersOrShareholders || '',
    bestPhoneNumber: contractor.bestPhoneNumber || '',
    bestEmailAddress: contractor.bestEmailAddress || contractor.email || '',
    companyLegalAddress: contractor.companyLegalAddress || '',
    companyLegalAddressStreet: contractor.companyLegalAddressStreet || '',
    companyLegalAddressCity: contractor.companyLegalAddressCity || '',
    companyLegalAddressState: contractor.companyLegalAddressState || '',
    companyLegalAddressZip: contractor.companyLegalAddressZip || '',
    otherCompanyAddress: contractor.otherCompanyAddress || '',
    otherCompanyAddressStreet: contractor.otherCompanyAddressStreet || '',
    otherCompanyAddressCity: contractor.otherCompanyAddressCity || '',
    otherCompanyAddressState: contractor.otherCompanyAddressState || '',
    otherCompanyAddressZip: contractor.otherCompanyAddressZip || '',
    companyRegisteredRegion: contractor.companyRegisteredRegion || '',
    legalRepresentativeName: contractor.legalRepresentativeName || '',
    legalRepresentativePhone: contractor.legalRepresentativePhone || '',
    legalRepresentativeEmail: contractor.legalRepresentativeEmail || '',
    projectManagerName: contractor.projectManagerName || '',
    projectManagerPhone: contractor.projectManagerPhone || '',
    projectManagerEmail: contractor.projectManagerEmail || '',
    // Individual fields
    legalName: contractor.legalName || contractor.displayName || '',
    taxIdentification: contractor.taxIdentification || '',
    currentAddress: contractor.currentAddress || '',
    currentAddressStreet: contractor.currentAddressStreet || '',
    currentAddressCity: contractor.currentAddressCity || '',
    currentAddressState: contractor.currentAddressState || '',
    currentAddressZip: contractor.currentAddressZip || '',
    otherAddress: contractor.otherAddress || '',
    otherAddressStreet: contractor.otherAddressStreet || '',
    otherAddressCity: contractor.otherAddressCity || '',
    otherAddressState: contractor.otherAddressState || '',
    otherAddressZip: contractor.otherAddressZip || '',
    birthRegion: contractor.birthRegion || '',
    mainSpecialization: contractor.mainSpecialization || '',
    serviceFeeDescription: contractor.serviceFeeDescription || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedProfile: any = {
        ...formData,
        displayName: formData.contractorType === 'company' ? formData.legalCompanyName : formData.legalName,
        updatedAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, 'Updated contractor profile')
      };

      await updateDoc(doc(db, 'users', contractor.uid), updatedProfile);
      toast.success(t('ProfileUpdated'));
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('EditProfile')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TypeOfContractor')}</label>
                  <select
                    value={formData.contractorType}
                    onChange={(e) => setFormData({...formData, contractorType: e.target.value as 'company' | 'individual'})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="individual">{t('Individual')}</option>
                    <option value="company">{t('Company')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {formData.contractorType === 'company' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalCompanyName')}</label>
                        <input required type="text" value={formData.legalCompanyName} onChange={(e) => setFormData({...formData, legalCompanyName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyTaxIdEIN')}</label>
                        <input required type="text" value={formData.companyTaxId} onChange={(e) => setFormData({...formData, companyTaxId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxIdType')}</label>
                        <input type="text" value={formData.taxIdType} onChange={(e) => setFormData({...formData, taxIdType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyLegalStructure')}</label>
                        <input type="text" value={formData.companyLegalStructure} onChange={(e) => setFormData({...formData, companyLegalStructure: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MembersOrShareholders')}</label>
                        <input type="text" value={formData.membersOrShareholders} onChange={(e) => setFormData({...formData, membersOrShareholders: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestPhoneNumber')}</label>
                        <input required type="text" value={formData.bestPhoneNumber} onChange={(e) => setFormData({...formData, bestPhoneNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestEmailAddress')}</label>
                        <input required type="email" value={formData.bestEmailAddress} onChange={(e) => setFormData({...formData, bestEmailAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyLegalAddress')}</label>
                        <input type="text" value={formData.companyLegalAddress} onChange={(e) => setFormData({...formData, companyLegalAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.companyLegalAddressStreet} onChange={(e) => setFormData({...formData, companyLegalAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.companyLegalAddressCity} onChange={(e) => setFormData({...formData, companyLegalAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.companyLegalAddressState} onChange={(e) => setFormData({...formData, companyLegalAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.companyLegalAddressZip} onChange={(e) => setFormData({...formData, companyLegalAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherCompanyAddress')}</label>
                        <input type="text" value={formData.otherCompanyAddress} onChange={(e) => setFormData({...formData, otherCompanyAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.otherCompanyAddressStreet} onChange={(e) => setFormData({...formData, otherCompanyAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.otherCompanyAddressCity} onChange={(e) => setFormData({...formData, otherCompanyAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.otherCompanyAddressState} onChange={(e) => setFormData({...formData, otherCompanyAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.otherCompanyAddressZip} onChange={(e) => setFormData({...formData, otherCompanyAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CompanyRegisteredRegion')}</label>
                        <input type="text" value={formData.companyRegisteredRegion} onChange={(e) => setFormData({...formData, companyRegisteredRegion: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceType')}</label>
                        <input type="text" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceStartDate')}</label>
                        <input type="date" value={formData.serviceStartDate} onChange={(e) => setFormData({...formData, serviceStartDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceEndDate')}</label>
                        <input type="date" value={formData.serviceEndDate} onChange={(e) => setFormData({...formData, serviceEndDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativeName')}</label>
                        <input type="text" value={formData.legalRepresentativeName} onChange={(e) => setFormData({...formData, legalRepresentativeName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativePhone')}</label>
                        <input type="text" value={formData.legalRepresentativePhone} onChange={(e) => setFormData({...formData, legalRepresentativePhone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalRepresentativeEmail')}</label>
                        <input type="email" value={formData.legalRepresentativeEmail} onChange={(e) => setFormData({...formData, legalRepresentativeEmail: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerName')}</label>
                        <input type="text" value={formData.projectManagerName} onChange={(e) => setFormData({...formData, projectManagerName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerPhone')}</label>
                        <input type="text" value={formData.projectManagerPhone} onChange={(e) => setFormData({...formData, projectManagerPhone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ProjectManagerEmail')}</label>
                        <input type="email" value={formData.projectManagerEmail} onChange={(e) => setFormData({...formData, projectManagerEmail: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceFee')}</label>
                        <input type="text" value={formData.serviceFee} onChange={(e) => setFormData({...formData, serviceFee: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherFeesDescription')}</label>
                        <input type="text" value={formData.otherFeesDescription} onChange={(e) => setFormData({...formData, otherFeesDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Note')}</label>
                        <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalName')}</label>
                        <input required type="text" value={formData.legalName} onChange={(e) => setFormData({...formData, legalName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TaxIdentificationSSN')}</label>
                        <input required type="text" value={formData.taxIdentification} onChange={(e) => setFormData({...formData, taxIdentification: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestPhoneNumber')}</label>
                        <input required type="text" value={formData.bestPhoneNumber} onChange={(e) => setFormData({...formData, bestPhoneNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BestEmailAddress')}</label>
                        <input required type="email" value={formData.bestEmailAddress} onChange={(e) => setFormData({...formData, bestEmailAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CurrentAddress')}</label>
                        <input type="text" value={formData.currentAddress} onChange={(e) => setFormData({...formData, currentAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.currentAddressStreet} onChange={(e) => setFormData({...formData, currentAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.currentAddressCity} onChange={(e) => setFormData({...formData, currentAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.currentAddressState} onChange={(e) => setFormData({...formData, currentAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.currentAddressZip} onChange={(e) => setFormData({...formData, currentAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherAddress')}</label>
                        <input type="text" value={formData.otherAddress} onChange={(e) => setFormData({...formData, otherAddress: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('Street')}</label>
                            <input type="text" value={formData.otherAddressStreet} onChange={(e) => setFormData({...formData, otherAddressStreet: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('City')}</label>
                            <input type="text" value={formData.otherAddressCity} onChange={(e) => setFormData({...formData, otherAddressCity: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('StateProvinceDept')}</label>
                            <input type="text" value={formData.otherAddressState} onChange={(e) => setFormData({...formData, otherAddressState: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('ZipCode')}</label>
                            <input type="text" value={formData.otherAddressZip} onChange={(e) => setFormData({...formData, otherAddressZip: e.target.value})} className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('BirthRegion')}</label>
                        <input type="text" value={formData.birthRegion} onChange={(e) => setFormData({...formData, birthRegion: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceType')}</label>
                        <input type="text" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('MainSpecialization')}</label>
                        <input type="text" value={formData.mainSpecialization} onChange={(e) => setFormData({...formData, mainSpecialization: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceStartDate')}</label>
                        <input type="date" value={formData.serviceStartDate} onChange={(e) => setFormData({...formData, serviceStartDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceEndDate')}</label>
                        <input type="date" value={formData.serviceEndDate} onChange={(e) => setFormData({...formData, serviceEndDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('ServiceFeeDescription')}</label>
                        <input type="text" value={formData.serviceFeeDescription} onChange={(e) => setFormData({...formData, serviceFeeDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('OtherFeesDescription')}</label>
                        <input type="text" value={formData.otherFeesDescription} onChange={(e) => setFormData({...formData, otherFeesDescription: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Note')}</label>
                        <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]" />
                      </div>
                    </>
                  )}
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  {t('SaveChanges')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ReferralDashboard = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'referrals'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
      // Sort alphabetically by name (fullName or legalCompanyName)
      const sorted = data.sort((a, b) => {
        const nameA = (a.type === 'company' ? a.legalCompanyName : a.fullName) || '';
        const nameB = (b.type === 'company' ? b.legalCompanyName : b.fullName) || '';
        return nameA.localeCompare(nameB);
      });
      setReferrals(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'referrals');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredReferrals = referrals.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    return (
      r.legalCompanyName?.toLowerCase().includes(searchLower) ||
      r.fullName?.toLowerCase().includes(searchLower) ||
      r.emailAddress?.toLowerCase().includes(searchLower) ||
      r.phoneNumber?.toLowerCase().includes(searchLower) ||
      r.physicalAddress?.toLowerCase().includes(searchLower) ||
      r.currentAddress?.toLowerCase().includes(searchLower) ||
      r.availableServices?.toLowerCase().includes(searchLower) ||
      r.availableProducts?.toLowerCase().includes(searchLower) ||
      r.specialization?.toLowerCase().includes(searchLower) ||
      r.note?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('ReferralDashboard')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('ManageReferrals')}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          {t('CreateReferral')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-blue-500 overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-blue-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('ReferralList')}</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('SearchReferrals')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-blue-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('LoadingReferrals')}</p>
            </div>
          ) : filteredReferrals.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-blue-600" />
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('NoReferralsFound')}</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold w-12">#</th>
                  <th className="px-6 py-4 font-semibold">{t('Name')}</th>
                  <th className="px-6 py-4 font-semibold">{t('EmailAddress')}</th>
                  <th className="px-6 py-4 font-semibold">{t('PhoneNumber')}</th>
                  <th className="px-6 py-4 font-semibold">{t('AvailableServices')}</th>
                  <th className="px-6 py-4 font-semibold text-center">{t('Type')}</th>
                  <th className="px-6 py-4 font-semibold text-center">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReferrals.map((referral, index) => (
                  <tr key={`referral-record-${referral.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-400">{index + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {referral.type === 'company' ? referral.legalCompanyName : referral.fullName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{referral.emailAddress}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{referral.phoneNumber}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      <div className="max-w-xs truncate" title={referral.availableServices}>
                        {referral.availableServices || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        referral.type === 'company' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {t(referral.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedReferral(referral)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-blue-500">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {t('Total')}: {filteredReferrals.length}
          </p>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedReferral && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReferral(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 dark:border-slate-700"
            >
              <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl ${selectedReferral.type === 'company' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {selectedReferral.type === 'company' ? <Briefcase size={32} /> : <UserIcon size={32} />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {selectedReferral.type === 'company' ? selectedReferral.legalCompanyName : selectedReferral.fullName}
                      </h2>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 ${selectedReferral.type === 'company' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {t(selectedReferral.type)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedReferral(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedReferral.type === 'company' ? (
                    <>
                      <DetailItem label={t('LegalCompanyName')} value={selectedReferral.legalCompanyName} />
                      <DetailItem label={t('PhoneNumber')} value={selectedReferral.phoneNumber} />
                      <DetailItem label={t('EmailAddress')} value={selectedReferral.emailAddress} />
                      <DetailItem label={t('PhysicalAddress')} value={selectedReferral.physicalAddress} />
                      <DetailItem label={t('AvailableServices')} value={selectedReferral.availableServices} />
                      <DetailItem label={t('AvailableProducts')} value={selectedReferral.availableProducts} />
                      <DetailItem label={t('YearsOfExperience')} value={selectedReferral.yearsOfExperience} />
                      <DetailItem label={t('Note')} value={selectedReferral.note} fullWidth />
                    </>
                  ) : (
                    <>
                      <DetailItem label={t('FullName')} value={selectedReferral.fullName} />
                      <DetailItem label={t('PhoneNumber')} value={selectedReferral.phoneNumber} />
                      <DetailItem label={t('EmailAddress')} value={selectedReferral.emailAddress} />
                      <DetailItem label={t('CurrentAddress')} value={selectedReferral.currentAddress} />
                      <DetailItem label={t('Specialization')} value={selectedReferral.specialization} />
                      <DetailItem label={t('AvailableServices')} value={selectedReferral.availableServices} />
                      <DetailItem label={t('AvailableProducts')} value={selectedReferral.availableProducts} />
                      <DetailItem label={t('YearsOfExperience')} value={selectedReferral.yearsOfExperience} />
                      <DetailItem label={t('Note')} value={selectedReferral.note} fullWidth />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ReferralIntakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

const DetailItem = ({ label, value, fullWidth = false }: { label: string, value?: string, fullWidth?: boolean }) => (
  <div className={`space-y-1 ${fullWidth ? 'md:col-span-2' : ''}`}>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 min-h-[3.5rem] flex items-center">
      {value || '-'}
    </div>
  </div>
);

const ReferralIntakeModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    type: 'individual' as 'company' | 'individual',
    legalCompanyName: '',
    fullName: '',
    phoneNumber: '',
    emailAddress: '',
    physicalAddress: '',
    currentAddress: '',
    availableServices: '',
    availableProducts: '',
    yearsOfExperience: '',
    specialization: '',
    note: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'referrals'), {
        ...formData,
        createdAt: new Date().toISOString(),
        audit: getAuditMetadata(profile, `Created referral for: ${formData.fullName || formData.legalCompanyName}`)
      });
      toast.success(t('ReferralCreated'));
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('ReferralIntakeForm')}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('TypeOfReferral')}</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'company' | 'individual' })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  >
                    <option value="individual">{t('Individual')}</option>
                    <option value="company">{t('Company')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {formData.type === 'company' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('LegalCompanyName')}</label>
                        <input required type="text" value={formData.legalCompanyName} onChange={(e) => setFormData({ ...formData, legalCompanyName: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PhoneNumber')}</label>
                        <input required type="text" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmailAddress')}</label>
                        <input required type="email" value={formData.emailAddress} onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PhysicalAddress')}</label>
                        <input required type="text" value={formData.physicalAddress} onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('AvailableServices')}</label>
                        <input required type="text" value={formData.availableServices} onChange={(e) => setFormData({ ...formData, availableServices: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('AvailableProducts')}</label>
                        <input required type="text" value={formData.availableProducts} onChange={(e) => setFormData({ ...formData, availableProducts: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('YearsOfExperience')}</label>
                        <input required type="text" value={formData.yearsOfExperience} onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('FullName')}</label>
                        <input required type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('PhoneNumber')}</label>
                        <input required type="text" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('EmailAddress')}</label>
                        <input required type="email" value={formData.emailAddress} onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('CurrentAddress')}</label>
                        <input required type="text" value={formData.currentAddress} onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Specialization')}</label>
                        <input required type="text" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('AvailableServices')}</label>
                        <input required type="text" value={formData.availableServices} onChange={(e) => setFormData({ ...formData, availableServices: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('AvailableProducts')}</label>
                        <input required type="text" value={formData.availableProducts} onChange={(e) => setFormData({ ...formData, availableProducts: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('YearsOfExperience')}</label>
                        <input required type="text" value={formData.yearsOfExperience} onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                      </div>
                    </>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{t('Note')}</label>
                    <textarea value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium min-h-[100px]" />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
                  {t('CreateReferral')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ContractorDashboard = () => {
  const { t } = useTranslation();
  const { isAdmin, canEdit } = useAuth();
  const [contractors, setContractors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'), where('isContractor', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setContractors(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const filteredContractors = contractors.filter(c => 
    (c.contractorDisplayName || c.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('IndependentContractorDashboard')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('ContractorManagementDesc')}</p>
          <div className="mt-4 relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={20} />
            <input
              type="text"
              placeholder={t('SearchContractors')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 self-start"
          >
            <UserPlus size={20} />
            {t('CreateContractor')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={selectedContractor ? "lg:col-span-2 space-y-8" : "lg:col-span-3 space-y-8"}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-blue-500" />
                {t('Contractors')}
              </h2>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">{t('ContractorName')}</th>
                    <th className="px-6 py-4 font-bold">{t('TypeOfContractor')}</th>
                    <th className="px-6 py-4 font-bold">{t('ServiceStartDate')}</th>
                    <th className="px-6 py-4 font-bold">{t('Status')}</th>
                    <th className="px-6 py-4 font-bold text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                        {t('Loading')}...
                      </td>
                    </tr>
                  ) : filteredContractors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {t('NoResultsFound')}
                      </td>
                    </tr>
                  ) : filteredContractors.map((contractor) => (
                    <tr 
                      key={`contractor-row-${contractor.uid}`} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer ${selectedContractor?.uid === contractor.uid ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      onClick={() => setSelectedContractor(contractor)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                            {(contractor.contractorDisplayName || contractor.displayName || 'C').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{contractor.contractorDisplayName || contractor.displayName}</div>
                            <div className="text-xs text-slate-500">{contractor.email}</div>
                            <AuditInfo audit={contractor.audit} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {contractor.contractorType ? t(contractor.contractorType.charAt(0).toUpperCase() + contractor.contractorType.slice(1)) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{contractor.serviceStartDate || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${contractor.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {t(contractor.status === 'active' ? 'Active' : 'Blocked')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                          <ChevronRight size={18} className="text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selectedContractor && (
          <div className="lg:col-span-1">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 space-y-6 sticky top-8"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold">
                    {(selectedContractor.contractorDisplayName || selectedContractor.displayName || 'C').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedContractor.contractorDisplayName || selectedContractor.displayName}</h3>
                    <p className="text-sm text-slate-500">{selectedContractor.contractorType ? t(selectedContractor.contractorType.charAt(0).toUpperCase() + selectedContractor.contractorType.slice(1)) : t('Contractor')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button 
                      onClick={() => setShowEditModal(true)}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-full transition-colors"
                      title={t('EditProfile')}
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                  <button onClick={() => setSelectedContractor(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserIcon size={18} className="text-blue-500" />
                  {t('ContractorInfo')}
                </h4>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{t('Email')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{t('Phone')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.bestPhoneNumber || selectedContractor.phoneNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{selectedContractor.contractorType === 'company' ? t('EIN') : t('SSN')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.companyTaxId || selectedContractor.taxIdentification || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{t('ServiceStartDate')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.serviceStartDate || selectedContractor.contractStartDate || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{t('ServiceType')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.serviceType || selectedContractor.mainSpecialization || '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500">{t('Address')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {selectedContractor.contractorType === 'company' ? (
                        <>
                          {selectedContractor.companyLegalAddressStreet && `${selectedContractor.companyLegalAddressStreet}, `}
                          {selectedContractor.companyLegalAddressCity && `${selectedContractor.companyLegalAddressCity}, `}
                          {selectedContractor.companyLegalAddressState && `${selectedContractor.companyLegalAddressState} `}
                          {selectedContractor.companyLegalAddressZip && `${selectedContractor.companyLegalAddressZip}, `}
                          {selectedContractor.companyRegisteredRegion}
                        </>
                      ) : (
                        <>
                          {selectedContractor.currentAddressStreet && `${selectedContractor.currentAddressStreet}, `}
                          {selectedContractor.currentAddressCity && `${selectedContractor.currentAddressCity}, `}
                          {selectedContractor.currentAddressState && `${selectedContractor.currentAddressState} `}
                          {selectedContractor.currentAddressZip && `${selectedContractor.currentAddressZip}, `}
                          {selectedContractor.birthRegion}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {selectedContractor.contractorType === 'company' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Briefcase size={18} className="text-emerald-500" />
                    {t('CompanyDetails')}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                      <span className="text-slate-500">{t('LegalStructure')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.companyLegalStructure || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                      <span className="text-slate-500">{t('MembersShareholders')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.membersOrShareholders || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard size={18} className="text-purple-500" />
                  {t('FinancialInfo')}
                </h4>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 dark:border-slate-700/50 pb-2">
                    <span className="text-slate-500">{t('ServiceFee')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.serviceFee || '-'}</span>
                  </div>
                  {selectedContractor.otherFeesDescription && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500">{t('OtherFeesDescription')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedContractor.otherFeesDescription}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedContractor.note && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('Note')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl italic">
                    "{selectedContractor.note}"
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      <NewContractorModal 
        isOpen={showNewModal} 
        onClose={() => setShowNewModal(false)} 
        onSuccess={(contractor) => {
          setSelectedContractor(contractor);
        }}
      />
      
      {selectedContractor && (
        <EditContractorModal 
          isOpen={showEditModal} 
          onClose={() => {
            setShowEditModal(false);
          }} 
          contractor={selectedContractor}
        />
      )}
    </div>
  );
};

const EmployeeProfilePage = () => {
  const { t } = useTranslation();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [employee, setEmployee] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivateStep, setDeactivateStep] = useState(0);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [clockSearchQuery, setClockSearchQuery] = useState('');
  const [balanceForm, setBalanceForm] = useState({
    sickHours: 0,
    vacationHours: 0,
    ptoHours: 0,
    errandsHours: 0
  });

  useEffect(() => {
    if (!employeeId) return;
    const unsub = onSnapshot(doc(db, 'users', employeeId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserProfile;
        setEmployee(data);
        setBalanceForm({
          sickHours: data.sickHoursBalance || 0,
          vacationHours: data.vacationHoursBalance || 0,
          ptoHours: data.ptoHoursBalance || 0,
          errandsHours: data.weeklyErrandsHoursBalance || 0
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [employeeId]);

  useEffect(() => {
    if (!employee || !employeeId || !canEdit) return;
    const currentYear = new Date().getFullYear();
    if (employee.lastYearlyAllocation !== currentYear) {
      const applyAllocation = async () => {
        try {
          await updateDoc(doc(db, 'users', employeeId), {
            sickHoursBalance: 60,
            vacationHoursBalance: 96,
            ptoHoursBalance: 72,
            lastYearlyAllocation: currentYear,
            'audit.updatedAt': Timestamp.now()
          });
          toast.info(t('YearlyAllocationApplied'));
        } catch (error) {
          console.error('Error applying yearly allocation:', error);
        }
      };
      applyAllocation();
    }
  }, [employee, employeeId, canEdit, t]);

  useEffect(() => {
    if (!employeeId) return;
    const q = query(
      collection(db, 'timeOffRequests'),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeOffRequest));
      setTimeOffRequests(requests);
    });
    return () => unsub();
  }, [employeeId]);

  const handleUpdateBalances = async () => {
    if (!employeeId) return;
    try {
      await updateDoc(doc(db, 'users', employeeId), {
        sickHoursBalance: balanceForm.sickHours,
        vacationHoursBalance: balanceForm.vacationHours,
        ptoHoursBalance: balanceForm.ptoHours,
        weeklyErrandsHoursBalance: balanceForm.errandsHours,
        'audit.updatedAt': Timestamp.now()
      });
      toast.success(t('BalancesUpdated'));
    } catch (error) {
      console.error('Error updating balances:', error);
      toast.error(t('UpdateFailed'));
    }
  };

  const handleTogglePortalAccess = async (emp: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', emp.uid), {
        status: emp.status === 'active' ? 'blocked' : 'active',
        'audit.updatedAt': Timestamp.now()
      });
      toast.success(t(emp.status === 'active' ? 'PortalDeactivated' : 'PortalReactivated'));
      setDeactivateStep(0);
    } catch (error) {
      console.error('Error toggling portal access:', error);
      toast.error(t('UpdateFailed'));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employeeId) return;

    try {
      const storageRef = ref(storage, `employee-files/${employeeId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const newFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url,
        uploadedAt: new Date().toISOString(),
        visibleToEmployee: false,
        folderId: currentFolderId || undefined
      };

      await updateDoc(doc(db, 'users', employeeId), {
        employeeFiles: arrayUnion(newFile)
      });
      toast.success(t('FileUploaded'));
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(t('UploadFailed'));
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!employeeId) return;
    try {
      const newFolder = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        createdAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'users', employeeId), {
        employeeFolders: arrayUnion(newFolder)
      });
      toast.success(t('FolderCreated'));
      setShowFolderModal(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error(t('CreateFailed'));
    }
  };

  const toggleFileVisibility = async (fileId: string) => {
    if (!employee || !employeeId) return;
    try {
      const updatedFiles = employee.employeeFiles?.map(f => 
        f.id === fileId ? { ...f, visibleToEmployee: !f.visibleToEmployee } : f
      );
      await updateDoc(doc(db, 'users', employeeId), {
        employeeFiles: updatedFiles
      });
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const calculateDuration = (inTime: string, outTime: string) => {
    if (!inTime || !outTime || outTime === '--:--') return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const start = inH * 60 + inM;
    const end = outH * 60 + outM;
    return Math.max(0, (end - start) / 60);
  };

  const groupedHistory = useMemo(() => {
    if (!employee) return [];
    const history = employee.clockInHistory || [];
    const weeks: { start: Date, end: Date, days: any[], totalHours: number }[] = [];
    
    // Get all unique dates from history plus the current week
    const dates = history.map(h => new Date(h.date + 'T00:00:00'));
    dates.push(new Date());
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    let current = startOfWeek(maxDate, { weekStartsOn: 0 });
    const endLimit = startOfWeek(minDate, { weekStartsOn: 0 });
    
    while (current >= endLimit) {
      const weekStart = current;
      const weekEnd = endOfWeek(current, { weekStartsOn: 0 });
      let totalHours = 0;
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = history.find(h => h.date === dateStr);
        if (record && record.clockIn && record.clockOut) {
          totalHours += calculateDuration(record.clockIn, record.clockOut);
        }
        return {
          date: dateStr,
          dayName: format(day, 'EEEE'),
          record
        };
      });
      
      weeks.push({ start: weekStart, end: weekEnd, days, totalHours });
      current = subWeeks(current, 1);
    }
    
    if (!clockSearchQuery.trim()) return weeks;
    
    const query = clockSearchQuery.toLowerCase();
    return weeks.filter(week => {
      const startStr = format(week.start, 'yyyy-MM-dd').toLowerCase();
      const endStr = format(week.end, 'yyyy-MM-dd').toLowerCase();
      return startStr.includes(query) || endStr.includes(query) || 
             week.days.some(d => d.date.toLowerCase().includes(query) || d.dayName.toLowerCase().includes(query));
    });
  }, [employee, clockSearchQuery]);

  const downloadFile = (file: any) => {
    window.open(file.url, '_blank');
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-600" size={48} /></div>;
  if (!employee) return <div className="text-center py-20">{t('EmployeeNotFound')}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/portal/team-portal')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            {t('BackToDashboard')}
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('EmployeeProfile')}
          </h1>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200"
          >
            <Edit2 size={20} />
            {t('EditProfile')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card & Stats */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 text-center">
            <div className="w-32 h-32 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center text-5xl font-bold mx-auto mb-6 shadow-inner">
              {employee.displayName.charAt(0)}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{employee.displayName}</h2>
            <p className="text-slate-500 font-medium mb-6">{employee.jobTitle || t('Employee')}</p>
            
            <div className="flex items-center justify-center gap-2 mb-8">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${employee.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {t(employee.status === 'active' ? 'Active' : 'Blocked')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('ClockInOut')}</div>
                <div className="flex items-center justify-center gap-2 text-emerald-600 text-2xl font-black">
                  <Clock size={24} />
                  {employee.clockInHistory?.filter(h => h.status === 'on-time').length || 0}
                </div>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Absences')}</div>
                <div className="flex items-center justify-center gap-2 text-red-600 text-2xl font-black">
                  <AlertTriangle size={24} />
                  {employee.clockInHistory?.filter(h => h.status === 'absent').length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Portal Access Card */}
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/30 p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${employee.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                <Shield size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('PortalAccess')}</h4>
                <p className="text-xs text-slate-500">{t(employee.status === 'active' ? 'PortalActiveDesc' : 'PortalDeactivatedDesc')}</p>
              </div>
            </div>

            {deactivateStep > 0 && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-700 shadow-sm animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t(employee.status === 'active' ? `DeactivateWarning${deactivateStep}` : `ReactivateWarning${deactivateStep}`)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {deactivateStep === 0 ? (
                canEdit && (
                  <button
                    onClick={() => setDeactivateStep(1)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-sm ${
                      employee.status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {t(employee.status === 'active' ? 'DeactivatePortal' : 'ReactivatePortal')}
                  </button>
                )
              ) : (
                <>
                  <button
                    onClick={() => setDeactivateStep(0)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (deactivateStep === 1) {
                          setDeactivateStep(2);
                        } else {
                          handleTogglePortalAccess(employee);
                        }
                      }}
                      className={`flex-1 py-4 rounded-2xl font-bold text-white transition-all shadow-lg ${
                        employee.status === 'active'
                          ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                      }`}
                    >
                      {deactivateStep === 1 ? t('Confirm') : t('Proceed')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6 invisible h-0 overflow-hidden">
            {/* Clock-in History Hidden per Request */}
          </div>
        </div>

        {/* Right Column: Details & Files */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 max-w-2xl">
            <div className="space-y-8">
              {/* Personal Info */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                      <UserIcon size={20} className="text-blue-600" />
                    </div>
                    {t('PersonalInfo')}
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('FirstName')}</span>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">{employee.employeeFirstName || employee.firstName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('MiddleName')}</span>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">{employee.employeeMiddleName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('LastName')}</span>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">{employee.employeeLastName || employee.lastName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('Email')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.email}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('Phone')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.employeePersonalPhone || employee.personalPhone || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('DOB')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.employeeDob || employee.dob || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('Department')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.department || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('JobTitle')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.jobTitle || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('TaxId')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.taxId || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('HireDate')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{employee.hireDate || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('Role')}</span>
                    <p className="font-bold text-slate-900 dark:text-white">{t(employee.role || 'client')}</p>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-2">{t('Address')}</span>
                  <p className="font-bold text-slate-900 dark:text-white leading-relaxed">
                    {employee.employeeStreetAddress || employee.streetAddress ? `${employee.employeeStreetAddress || employee.streetAddress}, ` : ''}
                    {employee.employeeCity || employee.city ? `${employee.employeeCity || employee.city}, ` : ''}
                    {employee.employeeStateProvince || employee.stateProvince ? `${employee.employeeStateProvince || employee.stateProvince} ` : ''}
                    {employee.employeeZipCode || employee.zipCode ? `${employee.employeeZipCode || employee.zipCode}, ` : ''}
                    {employee.employeeCountry || employee.country}
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">{t('EmergencyContact')}</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Name')}</span>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {employee.emergencyContactFirstName} {employee.emergencyContactLastName}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Phone')}</span>
                      <p className="font-bold text-slate-900 dark:text-white">{employee.emergencyContactPhone || '-'}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Email')}</span>
                      <p className="font-bold text-slate-900 dark:text-white">{employee.emergencyContactEmail || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Management - Moved here to be full width and "wider" */}
            <div className="pt-12 border-t border-slate-100 dark:border-slate-700 space-y-6">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Shield size={22} className="text-blue-500" />
                {t('BalanceManagement')}
              </h4>
              <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{t('SickDays')}</label>
                    <input 
                      type="number" 
                      value={balanceForm.sickHours} 
                      onChange={(e) => setBalanceForm({...balanceForm, sickHours: Number(e.target.value)})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{t('VacationDays')}</label>
                    <input 
                      type="number" 
                      value={balanceForm.vacationHours} 
                      onChange={(e) => setBalanceForm({...balanceForm, vacationHours: Number(e.target.value)})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{t('PTO')}</label>
                    <input 
                      type="number" 
                      value={balanceForm.ptoHours} 
                      onChange={(e) => setBalanceForm({...balanceForm, ptoHours: Number(e.target.value)})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{t('WeeklyErrands')}</label>
                    <input 
                      type="number" 
                      value={balanceForm.errandsHours} 
                      onChange={(e) => setBalanceForm({...balanceForm, errandsHours: Number(e.target.value)})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-blue-100 dark:border-blue-900/30">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('FullYearReference')}</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{t('SickDays')}</div>
                      <div className="text-sm font-black text-blue-600">60h</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{t('VacationDays')}</div>
                      <div className="text-sm font-black text-emerald-600">96h</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{t('PTO')}</div>
                      <div className="text-sm font-black text-purple-600">72h</div>
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <button 
                    onClick={handleUpdateBalances}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {t('SaveBalances')}
                  </button>
                )}
              </div>
            </div>

          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6 invisible h-0 overflow-hidden">
            {/* Time Off Requests Hidden per Request */}
          </div>

          {/* Benefits Block - Relocated here */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Gift size={22} className="text-purple-500" />
              {t('Benefits')}
            </h4>
            <div className="flex flex-wrap gap-3">
              {employee.benefits?.map((benefit, i) => (
                <span key={`admin-benefit-${employee.uid}-${i}`} className="px-5 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm font-bold rounded-2xl border border-purple-100 dark:border-purple-800 shadow-sm">
                  {benefit}
                </span>
              )) || <p className="text-sm text-slate-400 italic">{t('NoBenefitsAssigned')}</p>}
            </div>
          </div>

          {/* Files Section */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-8">
            <div className="flex justify-between items-center">
              <h4 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <FileText size={28} className="text-blue-500" />
                {t('EmployeeFiles')}
              </h4>
              <div className="flex items-center gap-3">
                {canEdit && (
                  <>
                    <button 
                      onClick={() => setShowFolderModal(true)}
                      className="p-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                      title={t('CreateFolder')}
                    >
                      <FolderPlus size={22} />
                    </button>
                    <label className="p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400 transition-all border border-blue-100 dark:border-blue-900/30 shadow-sm cursor-pointer" title={t('UploadDocument')}>
                      <FileUp size={22} />
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </>
                )}
              </div>
            </div>

            {currentFolderId && (
              <button 
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-2 text-sm font-black text-blue-600 hover:text-blue-700 transition-colors"
              >
                <ChevronLeft size={18} />
                {t('BackToRoot')}
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Folders */}
              {!currentFolderId && employee.employeeFolders?.map((folder) => (
                <div 
                  key={`admin-emp-folder-${folder.id}`} 
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-500">
                      <Folder size={24} className="fill-amber-500/20" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{folder.name}</span>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}

              {/* Files */}
              {employee.employeeFiles?.filter(f => f.folderId === (currentFolderId || undefined)).map((file) => (
                <div key={`admin-emp-file-${file.id}`} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 group hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-500">
                      <FileIcon size={24} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">{file.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{safeFormat(file.uploadedAt, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadFile(file)}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-blue-600 transition-colors"
                      title={t('Download')}
                    >
                      <Download size={20} />
                    </button>
                    {canEdit && (
                      <button 
                        onClick={() => toggleFileVisibility(file.id)}
                        className={`p-2 rounded-xl transition-all ${file.visibleToEmployee ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        title={t(file.visibleToEmployee ? 'VisibleToEmployee' : 'HiddenFromEmployee')}
                      >
                        {file.visibleToEmployee ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    )}
                  </div>
                </div>
              )) || (!currentFolderId && !employee.employeeFolders?.length && <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">{t('NoFilesUploaded')}</div>)}
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditEmployeeModal 
          key={`edit-employee-modal-${employee.uid}`}
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
          employee={employee} 
        />
      )}

      {showFolderModal && (
        <FolderModal 
          isOpen={showFolderModal} 
          onClose={() => setShowFolderModal(false)} 
          onCreate={handleCreateFolder} 
        />
      )}
    </div>
  );
};

export default function App() {
  const { t } = useTranslation();

  useEffect(() => {
    // Bootstrap logic removed as per user request
  }, []);

  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/employee-login" element={<EmployeeLogin />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/offices-and-admins" element={<ProtectedRoute adminOnly><WarningGate title={t('OfficesAndAdmins')}><OfficesAndAdmins /></WarningGate></ProtectedRoute>} />
          <Route path="/admin/supervision-admins" element={<ProtectedRoute adminOnly><SupervisionAdmins /></ProtectedRoute>} />
          <Route path="/admin/supervision-data" element={<ProtectedRoute><SupervisionDataPage /></ProtectedRoute>} />
          <Route path="/admin/supervision-data/:supervisedId" element={<ProtectedRoute><SupervisionDataPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users/:userId" element={<ProtectedRoute adminOnly><UserDetail /></ProtectedRoute>} />
          <Route path="/admin/contractors" element={<ProtectedRoute adminOnly><ContractorDashboard /></ProtectedRoute>} />
          <Route path="/admin/referrals" element={<ProtectedRoute adminOnly><ReferralDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute adminOnly><WarningGate title={t('ServicesAndClasses')}><ServicesManagement /></WarningGate></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute adminOnly><CalendarView /></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute adminOnly><Payments /></ProtectedRoute>} />
          <Route path="/admin/signatures" element={<ProtectedRoute adminOnly><Signatures /></ProtectedRoute>} />

          {/* Client Routes */}
          <Route path="/portal" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/portal/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
          <Route path="/portal/sales-team" element={<ProtectedRoute><SalesTeam /></ProtectedRoute>} />
          <Route path="/portal/team-portal" element={<ProtectedRoute><TeamPortalSystem /></ProtectedRoute>} />
          <Route path="/portal/team-portal/employee/:employeeId" element={<ProtectedRoute><EmployeeProfilePage /></ProtectedRoute>} />
          <Route path="/admin/forms-bank" element={<ProtectedRoute adminOnly><FormsBank /></ProtectedRoute>} />
          <Route path="/portal/dashboard" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
          <Route path="/portal/appointments" element={<ProtectedRoute><AppointmentsList /></ProtectedRoute>} />
          <Route path="/portal/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
          <Route path="/portal/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path="/portal/documents" element={<ProtectedRoute><DocumentsView /></ProtectedRoute>} />
          <Route path="/portal/signatures" element={<ProtectedRoute><Signatures /></ProtectedRoute>} />

          <Route path="/forms/:id" element={<PublicForm />} />
          <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}
