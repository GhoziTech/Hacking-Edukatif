import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, updateDoc, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
// Konfigurasi Firebase - GANTI DENGAN KONFIGURASI ANDA
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY || "AIzaSyBPLDXtbP-sKWdSXbEzPcpm1iWaaVe0LQ4",
  authDomain: process.env.REACT_APP_AUTH_DOMAIN || "ghozi-tech.firebaseapp.com",
  projectId: process.env.REACT_APP_PROJECT_ID || "ghozi-tech",
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET || "ghozi-tech.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID || "1007492022053",
  appId: process.env.REACT_APP_APP_ID || "1:1007492022053:web:412fc1181cab1daca324cc"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Komponen utama aplikasi
const GhozitechApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'level' | 'leaderboard' | 'withdraw' | 'admin'>('login');
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [currentLevel, setCurrentLevel] = useState(1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Ambil data user dari Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // Buat data user baru jika belum ada
          const newUserData = {
            uid: user.uid,
            email: user.email,
            username: user.displayName || user.email?.split('@')[0],
            totalPoints: 0,
            completedMissions: 0,
            accuracy: 0,
            fastestTime: 0,
            lastPlayed: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), newUserData);
          setUserData(newUserData);
        }
        setCurrentView('dashboard');
      } else {
        setUser(null);
        setUserData(null);
        setCurrentView('login');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login gagal. Periksa email dan password Anda.');
    }
  };

  const handleSignup = async (email: string, password: string, username: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUserData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        username: username,
        totalPoints: 0,
        completedMissions: 0,
        accuracy: 0,
        fastestTime: 0,
        lastPlayed: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
    } catch (error) {
      console.error('Signup error:', error);
      alert('Pendaftaran gagal. Silakan coba lagi.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google login error:', error);
      alert('Login dengan Google gagal.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const startLevel = (level: number) => {
    // Cek apakah user sudah menyelesaikan level ini hari ini
    const today = new Date().toISOString().split('T')[0];
    const levelCompletionKey = `level_${level}_completed_${today}`;
    
    if (userData?.dailyCompletions?.[levelCompletionKey]) {
      alert('Anda sudah menyelesaikan level ini hari ini. Coba lagi besok!');
      return;
    }
    
    setCurrentLevel(level);
    setCurrentView('level');
  };

  const completeLevel = async (points: number, time: number) => {
    if (!user || !userData) return;
    
    const today = new Date().toISOString().split('T')[0];
    const levelCompletionKey = `level_${currentLevel}_completed_${today}`;
    
    // Cek apakah sudah menyelesaikan level ini hari ini
    if (userData.dailyCompletions?.[levelCompletionKey]) {
      alert('Anda sudah menyelesaikan level ini hari ini. Poin tidak ditambahkan.');
      setCurrentView('dashboard');
      return;
    }
    
    const newPoints = userData.totalPoints + points;
    const newCompletedMissions = userData.completedMissions + 1;
    const newAccuracy = ((userData.accuracy * userData.completedMissions) + 100) / newCompletedMissions;
    const newFastestTime = userData.fastestTime === 0 ? time : Math.min(userData.fastestTime, time);
    
    // Update daily completions
    const dailyCompletions = {
      ...userData.dailyCompletions,
      [levelCompletionKey]: new Date().toISOString()
    };
    
    const updatedUserData = {
      ...userData,
      totalPoints: newPoints,
      completedMissions: newCompletedMissions,
      accuracy: newAccuracy,
      fastestTime: newFastestTime,
      dailyCompletions,
      lastPlayed: new Date().toISOString()
    };
    
    await updateDoc(doc(db, 'users', user.uid), updatedUserData);
    setUserData(updatedUserData);
    
    // Simpan riwayat level
    await addDoc(collection(db, 'level_completions'), {
      userId: user.uid,
      level: currentLevel,
      pointsEarned: points,
      timeTaken: time,
      completedAt: new Date().toISOString(),
      date: today
    });
    
    // Tampilkan iklan setelah menyelesaikan level
    showAdPopup();
    
    setCurrentView('dashboard');
    alert(`Level ${currentLevel} selesai! Anda mendapatkan ${points} poin.`);
  };
  
  const showAdPopup = () => {
    // Implementasi iklan popup sederhana
    const showAd = confirm('Tonton iklan untuk mendapatkan bonus 50 poin?');
    if (showAd) {
      // Simulasikan iklan rewarded
      setTimeout(() => {
        if (user && userData) {
          const bonusPoints = userData.totalPoints + 50;
          updateDoc(doc(db, 'users', user.uid), {
            totalPoints: bonusPoints
          });
          setUserData({...userData, totalPoints: bonusPoints});
          alert('Bonus 50 poin ditambahkan!');
        }
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <header className="p-4 border-b border-green-600">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-500">GHOZITECH</h1>
          {user && (
            <nav className="flex space-x-4">
              <button onClick={() => setCurrentView('dashboard')} className="hover:text-green-300">Dashboard</button>
              <button onClick={() => setCurrentView('leaderboard')} className="hover:text-green-300">Leaderboard</button>
              <button onClick={() => setCurrentView('withdraw')} className="hover:text-green-300">Tukar Poin</button>
              <button onClick={handleLogout} className="hover:text-green-300">Logout</button>
            </nav>
          )}
        </div>
      </header>

      <main className="container mx-auto p-4">
        {currentView === 'login' && (
          <LoginView 
            onLogin={handleLogin}
            onSignup={handleSignup}
            onGoogleLogin={handleGoogleLogin}
          />
        )}

        {currentView === 'dashboard' && userData && (
          <DashboardView 
            userData={userData}
            onStartLevel={startLevel}
          />
        )}

        {currentView === 'level' && (
          <LevelView 
            level={currentLevel}
            onComplete={completeLevel}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView />
        )}

        {currentView === 'withdraw' && userData && (
          <WithdrawView 
            userData={userData}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'admin' && (
          <AdminView />
        )}
      </main>
    </div>
  );
};

// Komponen Login/Signup
const LoginView: React.FC<{
  onLogin: (email: string, password: string) => void;
  onSignup: (email: string, password: string, username: string) => void;
  onGoogleLogin: () => void;
}> = ({ onLogin, onSignup, onGoogleLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password);
    } else {
      onSignup(email, password, username);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-gray-900 rounded-lg border border-green-600">
      <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? 'Login' : 'Daftar'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 bg-black border border-green-600 rounded text-white"
              required
            />
          </div>
        )}
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 bg-black border border-green-600 rounded text-white"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 bg-black border border-green-600 rounded text-white"
            required
          />
        </div>
        <button type="submit" className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700">
          {isLogin ? 'Login' : 'Daftar'}
        </button>
      </form>
      
      <button
        onClick={onGoogleLogin}
        className="w-full mt-4 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Login dengan Google
      </button>
      
      <p className="mt-4 text-center">
        {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-green-400 hover:underline"
        >
          {isLogin ? 'Daftar di sini' : 'Login di sini'}
        </button>
      </p>
    </div>
  );
};

// Komponen Dashboard
const DashboardView: React.FC<{
  userData: any;
  onStartLevel: (level: number) => void;
}> = ({ userData, onStartLevel }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900 p-6 rounded-lg border border-green-600 mb-6">
        <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black p-4 rounded border border-green-600">
            <h3 className="text-lg font-semibold">Total Poin</h3>
            <p className="text-2xl text-green-400">{userData.totalPoints}</p>
          </div>
          <div className="bg-black p-4 rounded border border-green-600">
            <h3 className="text-lg font-semibold">Misi Diselesaikan</h3>
            <p className="text-2xl text-green-400">{userData.completedMissions}</p>
          </div<div className="bg-black p-4 rounded border border-green-600">
          <h3 className="text-lg font-semibold">Akurasi</h3>
          <p className="text-2xl text-green-400">
            {userData.completedMissions > 0 ? userData.accuracy.toFixed(1) : '0'}%
          </p>
        </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Level Tersedia</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-black p-4 rounded border border-green-600">
              <h4 className="font-semibold">Level 1: Password Cracker</h4>
              <p className="text-sm text-gray-400 mb-2">Crack password dengan brute force</p>
              <button 
                onClick={() => onStartLevel(1)}
                className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mulai
              </button>
            </div>
            <div className="bg-black p-4 rounded border border-green-600">
              <h4 className="font-semibold">Level 2: SQL Injection</h4>
              <p className="text-sm text-gray-400 mb-2">Eksploitasi form login dengan SQLi</p>
              <button 
                onClick={() => onStartLevel(2)}
                className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mulai
              </button>
            </div>
            <div className="bg-black p-4 rounded border border-green-600">
              <h4 className="font-semibold">Level 3: Bug Hunter</h4>
              <p className="text-sm text-gray-400 mb-2">Temukan bug dalam kode</p>
              <button 
                onClick={() => onStartLevel(3)}
                className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mulai
              </button>
            </div>
          </div>
        </div<div>
          <h3 className="text-xl font-semibold mb-3">Daily Challenge</h3>
          <div className="bg-black p-4 rounded border border-green-600">
            <h4 className="font-semibold">Challenge Harian</h4>
            <p className="text-sm text-gray-400 mb-2">Selesaikan level 2 dalam waktu kurang dari 60 detik</p>
            <p className="text-green-400">Hadiah: 200 poin bonus</p>
            <button 
              onClick={() => startLevel(2)}
              className="mt-2 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ambil Challenge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen Level Game
const LevelView: React.FC<{
  level: number;
  onComplete: (points: number, time: number) => void;
  onCancel: () => void;
}> = ({ level, onComplete, onCancel }) => {
  const [timeLeft, setTimeLeft] = useState(180); // 3 menit
  const [startTime] = useState(Date.now());
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  useEffect(() => {
    if (timeLeft <= 0 && gameState === 'playing') {
      setGameState('lost');
      return;
    }

    const timer = setInterval(() => {
      if (gameState === 'playing') {
        setTimeLeft(prev => prev - 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, gameState]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (level === 1) {
      // Level 1: Password Cracker
      addLog(`Mencoba password: ${input}`);
      if (input === 'admin123') {
        addLog('SUKSES: Password ditemukan!');
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        setGameState('won');
        onComplete(100, timeTaken);
      } else {
        addLog('GAGAL: Password salah');
        setInput('');
      }
    } else if (level === 2) {
      // Level 2: SQL Injection
      addLog(`Payload dikirim: ${input}`);
      if (input.includes("' OR 1=1 --") || input.includes("' OR '1'='1")) {
        addLog('SUKSES: SQL Injection berhasil! Akses diberikan.');
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        setGameState('won');
        onComplete(150, timeTaken);
      } else {
        addLog('GAGAL: Payload tidak efektif');
        setInput('');
      }
    }
  };

  const handleCodeClick = (lineNumber: number) => {
    if (level === 3) {
      // Level 3: Bug Hunter
      addLog(`Memeriksa baris ${lineNumber}`);
      if (lineNumber === 3) {
        addLog('SUKSES: Bug ditemukan! Kerentanan XSS pada baris 3.');
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        setGameState('won');
        onComplete(200, timeTaken);
      } else {
        addLog('GAGAL: Tidak ada bug di baris ini');
      }
    }
  };

  if (gameState === 'won') {
    return (
      <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-lg border border-green-600">
        <h2 className="text-2xl font-bold mb-4 text-green-400">LEVEL {level} SELESAI!</h2>
        <p className="mb-4">Selamat! Anda berhasil menyelesaikan level ini.</p>
        <button 
          onClick={onCancel}
          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  if (gameState === 'lost') {
    return (
      <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-lg border border-red-600">
        <h2 className="text-2xl font-bold mb-4 text-red-400">WAKTU HABIS!</h2>
        <p className="mb-4">Waktu Anda telah habis. Coba lagi.</p>
        <button 
          onClick={onCancel}
          className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-lg border border-green-600">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Level {level}</h2>
        <div className="text-lg">
          Waktu: <span className="text-green-400">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>

      {level === 1 && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Password Cracker</h3>
          <p className="mb-4">Coba tebak password admin. Hint: password terdiri dari 8 karakter.</p>
          <form onSubmit={handleSubmit} className="mb-4">
            <input
              type="text"
              value={input}
              onChange={handleInput}
              placeholder="Masukkan password..."
              className="w-full p-2 bg-black border border-green-600 rounded text-white mb-2"
            />
            <button type="submit" className="p-2 bg-green-600 text-white rounded hover:bg-green-700">
              Coba Password
            </button>
          </form>
        </div>
      )}

      {level === 2 && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">SQL Injection</h3>
          <p className="mb-4">Eksploitasi form login dengan SQL Injection untuk mendapatkan akses.</p>
          <div className="bg-black p-4 rounded border border-gray-600 mb-4">
            <h4 className="font-semibold mb-2">Login Form</h4>
            <div className="mb-2">
              <input type="text" placeholder="Username" className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white mb-2" disabled />
            </div>
            <div className="mb-2">
              <input type="password" placeholder="Password" className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white mb-2" disabled />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="mb-4">
            <input
              type="text"
              value={input}
              onChange={handleInput}
              placeholder="Masukkan payload SQL Injection..."
              className="w-full p-2 bg-black border border-green-600 rounded text-white mb-2"
            />
            <button type="submit" className="p-2 bg-green-600 text-white rounded hover:bg-green-700">
              Inject
            </button>
          </form>
        </div>
      )}

      {level === 3 && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Bug Hunter</h3>
          <p className="mb-4">Temukan bug keamanan dalam kode berikut:</p>
          <div className="bg-black p-4 rounded border border-gray-600 mb-4 font-mono text-sm">
            <div className="mb-1 hover:bg-gray-800 cursor-pointer" onClick={() => handleCodeClick(1)}>
              <span className="text-gray-500">1 | </span>function displayUserInput() {'{'}
            </div>
            <div className="mb-1 hover:bg-gray-800 cursor-pointer" onClick={() => handleCodeClick(2)}>
              <span className="text-gray-500">2 | </span>  const userInput = document.getElementById('user-input').value;
            </div>
            <div className="mb-1 hover:bg-gray-800 cursor-pointer" onClick={() => handleCodeClick(3)}>
              <span className="text-gray-500">3 | </span>  document.getElementById('output').innerHTML = userInput;
            </div>
            <div className="mb-1 hover:bg-gray-800 cursor-pointer" onClick={() => handleCodeClick(4)}>
              <span className="text-gray-500">4 | </span>{'}'}
            </div>
          </div>
          <p className="text-sm text-gray-400">Klik pada baris yang menurut Anda mengandung bug.</p>
        </div>
      )}

      <div className="bg-black p-4 rounded border border-gray-600 h-48 overflow-y-auto">
        <h4 className="font-semibold mb-2">System Log</h4>
        <div className="font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>

      <button 
        onClick={onCancel}
        className="mt-4 p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        Batalkan
      </button>
    </div>
  );
};

// Komponen Leaderboard
const LeaderboardView: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-lg border border-green-600">
      <h2 className="text-2xl font-bold mb-6">Leaderboard Global</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black">
              <th className="p-3 border border-green-600 text-left">Peringkat</th>
              <th className="p-3 border border-green-600 text-left">Username</th>
              <th className="p-3 border border-green-600 text-left">Poin</th>
              <th className="p-3 border border-green-600 text-left">Misi</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => (
              <tr key={user.id} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                <td className="p-3 border border-green-600">#{index + 1}</td>
                <td className="p-3 border border-green-600">{user.username}</td>
                <td className="p-3 border border-green-600">{user.totalPoints}</td>
                <td className="p-3 border border-green-600">{user.completedMissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Komponen Penukaran Poin
const WithdrawView: React.FC<{
  userData: any;
  onCancel: () => void;
}> = ({ userData, onCancel }) => {
  const [walletType, setWalletType] = useState('gopay');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState(10000);

  const handleWithdraw = async () => {
    if (userData.totalPoints < amount) {
      alert('Poin tidak cukup untuk penukaran ini.');
      return;
    }

    if (amount < 10000) {
      alert('Minimum penukaran adalah 10.000 poin.');
      return;
    }

    try {
      // Simpan permintaan penukaran
      await addDoc(collection(db, 'withdraw_requests'), {
        userId: userData.uid,
        username: userData.username,
        walletType,
        phoneNumber,
        points: amount,
        cashAmount: amount / 1000, // 10.000 poin = Rp 10.000
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      // Kurangi poin user
      await updateDoc(doc(db, 'users', userData.uid), {
        totalPoints: userData.totalPoints - amount
      });

      alert('Permintaan penukaran berhasil dikirim. Menunggu verifikasi admin.');
      onCancel();
    } catch (error) {
      console.error('Withdraw error:', error);
      alert('Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900 p-6 rounded-lg border border-green-600">
      <h2 className="text-2xl font-bold mb-6">Tukar Poin</h2>
      <div className="mb-4">
        <p className="mb-2">Poin Anda: <span className="text-green-400">{userData.totalPoints}</span></p>
        <p className="text-sm text-gray-400">Minimum penukaran: 10.000 poin = Rp 10.000</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block mb-1">Jumlah Poin yang Ditukar</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min="10000"
            max={userData.totalPoints}
            className="w-full p-2 bg-black border border-green-600 rounded text-white"
          />
          <p className="text-sm text-gray-400 mt-1">Akan mendapatkan: Rp {amount / 1000}</p>
        </div>
        
        <div>
          <label className="block mb-1">E-Wallet</label>
          <select
            value={walletType}
            onChange={(e) => setWalletType(e.target.value)}
            className="w-full p-2 bg-black border border-green-600 rounded text-white"
          >
            <option value="gopay">GoPay</option>
            <option value="dana">DANA</option>
            <option value="ovo">OVO</option>
            <option value="shopeepay">ShopeePay</option>
          </select>
        </div>
        
        <div>
          <label className="block mb-1">Nomor HP</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full p-2 bg-black border border-green-600 rounded text-white"
          />
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleWithdraw}
            className="flex-1 p-2 bg-green-600 text-white rounded hover:bg-green-700"
            disabled={userData.totalPoints < 10000}
          >
            Tukar Sekarang
          </button>
          <button
            onClick={onCancel}
            className="flex-1 p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

// Komponen Admin (sederhana)
const AdminView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-lg border border-green-600">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <p className="text-center">Fitur admin sedang dalam pengembangan.</p>
    </div>
  );
};

export default GhozitechApp;
