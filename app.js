// app.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously } = require('firebase/auth');
const { getDatabase, ref, set, get, update, push, query, orderByChild, limitToLast } = require('firebase/database');

const app = express();

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAeAohW0cpt76YBmk_Mei6kGsHdr-Z0fSI",
  authDomain: "wish-1f288.firebaseapp.com",
  databaseURL: "https://wish-1f288-default-rtdb.firebaseio.com",
  projectId: "wish-1f288",
  storageBucket: "wish-1f288.appspot.com",
  messagingSenderId: "125423201790",
  appId: "1:125423201790:web:dda646897ba89d652ae4af"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));
app.set('view engine', 'ejs');

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.get('/', async (req, res) => {
  try {
    const wishesRef = ref(database, 'wishes');
    const wishesQuery = query(wishesRef, orderByChild('timestamp'), limitToLast(20));
    const snapshot = await get(wishesQuery);
    const wishes = [];
    snapshot.forEach((childSnapshot) => {
      wishes.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    wishes.reverse(); // To show most recent first
    res.render('home', { user: req.session.user, wishes });
  } catch (error) {
    console.error("Error fetching wishes:", error);
    res.render('home', { user: req.session.user, wishes: [], error: error.message });
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await set(ref(database, 'users/' + user.uid), {
      email: email,
      anonymity: false,
      messagingEnabled: true
    });
    req.session.user = user;
    res.redirect('/profile');
  } catch (error) {
    console.error("Signup error:", error);
    res.render('signup', { error: error.message });
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    req.session.user = user;
    res.redirect('/profile');
  } catch (error) {
    console.error("Login error:", error);
    res.render('login', { error: error.message });
  }
});

app.get('/anonymous-login', async (req, res) => {
  try {
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    await set(ref(database, 'users/' + user.uid), {
      anonymity: true,
      messagingEnabled: false
    });
    req.session.user = user;
    res.redirect('/profile');
  } catch (error) {
    console.error("Anonymous login error:", error);
    res.render('home', { error: error.message });
  }
});

app.get('/profile', isLoggedIn, async (req, res) => {
  try {
    const snapshot = await get(ref(database, 'users/' + req.session.user.uid));
    const userData = snapshot.val() || {};
    res.render('profile', { 
      user: req.session.user, 
      preferences: {
        anonymity: userData.anonymity || false,
        messagingEnabled: userData.messagingEnabled || false
      }
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.render('profile', { user: req.session.user, preferences: {}, error: error.message });
  }
});

app.post('/update-preferences', isLoggedIn, async (req, res) => {
  const { anonymity, messagingEnabled } = req.body;
  try {
    await update(ref(database, 'users/' + req.session.user.uid), {
      anonymity: anonymity === 'on',
      messagingEnabled: messagingEnabled === 'on'
    });
    res.redirect('/profile');
  } catch (error) {
    console.error("Update preferences error:", error);
    res.render('profile', { user: req.session.user, preferences: {}, error: error.message });
  }
});

app.get('/submit-wish', isLoggedIn, (req, res) => {
  res.render('submit-wish');
});

app.post('/submit-wish', isLoggedIn, async (req, res) => {
  const { title, description, category, fulfillmentType, urgency, visibility, allowMessaging, tags } = req.body;
  try {
    const newWishRef = push(ref(database, 'wishes'));
    await set(newWishRef, {
      userId: req.session.user.uid,
      title,
      description,
      category,
      fulfillmentType,
      urgency: urgency === 'on',
      visibility,
      allowMessaging: allowMessaging === 'on',
      tags: tags.split(',').map(tag => tag.trim()),
      timestamp: Date.now(),
      status: 'open'
    });
    res.redirect('/wish-confirmation/' + newWishRef.key);
  } catch (error) {
    console.error("Wish submission error:", error);
    res.render('submit-wish', { error: error.message });
  }
});

app.get('/wish-confirmation/:wishId', isLoggedIn, async (req, res) => {
  try {
    const wishRef = ref(database, 'wishes/' + req.params.wishId);
    const snapshot = await get(wishRef);
    const wish = snapshot.val();
    res.render('wish-confirmation', { wishId: req.params.wishId, wish });
  } catch (error) {
    console.error("Wish confirmation error:", error);
    res.render('wish-confirmation', { error: error.message });
  }
});

app.get('/wishes', async (req, res) => {
  try {
    const { category, urgency, fulfillmentType, tags, sort } = req.query;
    let wishesRef = ref(database, 'wishes');
    
    // Apply filters
    if (category) {
      wishesRef = query(wishesRef, orderByChild('category'), equalTo(category));
    }
    if (urgency === 'true') {
      wishesRef = query(wishesRef, orderByChild('urgency'), equalTo(true));
    }
    if (fulfillmentType) {
      wishesRef = query(wishesRef, orderByChild('fulfillmentType'), equalTo(fulfillmentType));
    }
    
    const snapshot = await get(wishesRef);
    let wishes = [];
    snapshot.forEach((childSnapshot) => {
      wishes.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    
    // Apply tag filter
    if (tags) {
      const tagArray = tags.split(',');
      wishes = wishes.filter(wish => wish.tags.some(tag => tagArray.includes(tag)));
    }
    
    // Apply sorting
    if (sort === 'recent') {
      wishes.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sort === 'urgent') {
      wishes.sort((a, b) => (b.urgency ? 1 : 0) - (a.urgency ? 1 : 0));
    }
    
    res.render('wishes', { wishes, user: req.session.user });
  } catch (error) {
    console.error("Wishes fetch error:", error);
    res.render('wishes', { wishes: [], error: error.message, user: req.session.user });
  }
});

app.get('/wishes', async (req, res) => {
  try {
    const { category, urgency, fulfillmentType, tags, sort } = req.query;
    let wishesRef = ref(database, 'wishes');
    
    // Apply filters
    if (category) {
      wishesRef = query(wishesRef, orderByChild('category'), equalTo(category));
    }
    if (urgency === 'true') {
      wishesRef = query(wishesRef, orderByChild('urgency'), equalTo(true));
    }
    if (fulfillmentType) {
      wishesRef = query(wishesRef, orderByChild('fulfillmentType'), equalTo(fulfillmentType));
    }
    
    const snapshot = await get(wishesRef);
    let wishes = [];
    snapshot.forEach((childSnapshot) => {
      wishes.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    
    // Apply tag filter
    if (tags) {
      const tagArray = tags.split(',');
      wishes = wishes.filter(wish => wish.tags.some(tag => tagArray.includes(tag)));
    }
    
    // Apply sorting
    if (sort === 'recent') {
      wishes.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sort === 'urgent') {
      wishes.sort((a, b) => (b.urgency ? 1 : 0) - (a.urgency ? 1 : 0));
    }
    
    res.render('wishes', { wishes, user: req.session.user });
  } catch (error) {
    console.error("Wishes fetch error:", error);
    res.render('wishes', { wishes: [], error: error.message, user: req.session.user });
  }
});

// Fetch specific wish by ID
app.get('/wish/:id', async (req, res) => {
  try {
    const wishId = req.params.id;
    console.log('Fetching wish with ID:', wishId);  // Log the wishId

    const wishRef = db.ref(`wishes/${wishId}`);
    const snapshot = await wishRef.once('value');
    const wish = snapshot.val();
    
    // Log the response from Firebase
    console.log('Wish fetched:', wish);
    
    if (!wish) {
      return res.status(404).send('Wish not found');
    }

    res.render('wish-details', { wish });
  } catch (error) {
    console.error('Error fetching wish details:', error);
    res.status(500).send('Error fetching wish details.');
  }
});



// Fulfill Wish Route
app.post('/wish/fulfill/:id', async (req, res) => {
  const wishId = req.params.id;
  const fulfillmentDetails = req.body.fulfillmentDetails;
  
  try {
    const wishRef = firebase.database().ref(`/wishes/${wishId}`);
    const wish = await wishRef.once('value');
    
    if (wish.exists()) {
      const wishData = wish.val();
      
      // Update the wish status to "In Progress" or "Fulfilled"
      const newStatus = wishData.fulfillmentType === 'single' ? 'Fulfilled' : 'In Progress';
      await wishRef.update({
        status: newStatus,
        fulfillmentDetails: fulfillmentDetails
      });
      
      // Redirect to a success page or show a confirmation message
      res.redirect(`/wish/${wishId}`);
    } else {
      res.status(404).send('Wish not found');
    }
  } catch (error) {
    console.error('Error fulfilling wish:', error);
    res.status(500).send('Error fulfilling the wish');
  }
});

// My Wishes Route
app.get('/mywishes', async (req, res) => {
  const userId = req.session.user.id;
  
  try {
    // Fetch all wishes of the logged-in user
    const wishesRef = firebase.database().ref('/wishes').orderByChild('userId').equalTo(userId);
    const userWishesSnapshot = await wishesRef.once('value');
    
    const wishes = [];
    userWishesSnapshot.forEach((wishSnapshot) => {
      wishes.push({ id: wishSnapshot.key, ...wishSnapshot.val() });
    });
    
    res.render('myWishes', { wishes });
  } catch (error) {
    console.error('Error fetching user wishes:', error);
    res.status(500).send('Error loading your wishes');
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});