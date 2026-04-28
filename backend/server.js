require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// --- WS: 1. Import necessary modules ---
const http = require('http');
const { WebSocketServer } = require('ws');


const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS                                                                                                                         ,
  database: process.env.DB_NAME,
  waitForConnections: true, // Ensures connections are queued if the pool is full
  connectionLimit: 10, // Maximum number of connections in the pool
  queueLimit: 0 // Unlimited queueing for connection requests
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL database');
  connection.release();
});

const app = express();
const PORT = process.env.PORT || 5002;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  console.log(`[${new Date().toLocaleString()}] WebSocket client connected.`);
  ws.on('close', () => {
    console.log(`[${new Date().toLocaleString()}] WebSocket client disconnected.`);
  });
  ws.on('error', error => {
    console.error(`[${new Date().toLocaleString()}] WebSocket Error:`, error);
  });
});

function broadcastDataUpdate() {
  console.log(`[${new Date().toLocaleString()}] Broadcasting 'data_changed' to ${wss.clients.size} clients.`);
  const message = JSON.stringify({ event: 'data_changed' });
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

app.use(cors());
app.use(bodyParser.json());

// Test route
app.get('/', (req, res) => {
  res.send('RFID Backend Server is running 🚀');
});

app.get('/api/force-refresh', (req, res) => {
    console.log(`[${new Date().toLocaleString()}] Manual refresh triggered via /api/force-refresh endpoint.`);
  
    broadcastDataUpdate();

    res.status(200).send('Broadcast event "data_changed" has been sent to all connected clients.');
});

app.post('/api/internal-trigger-refresh', (req, res) => {
    const secret = req.headers['x-trigger-secret'];
    if (!process.env.TRIGGER_SECRET || secret !== process.env.TRIGGER_SECRET) {
        console.log("Unauthorized attempt to access internal trigger.");
        return res.status(403).send('Forbidden');
    }

    console.log(`[${new Date().toLocaleString()}] Received internal trigger. Broadcasting data update.`);
    broadcastDataUpdate();
    res.status(200).send('Broadcast initiated.');
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  db.getConnection((connErr, connection) => {
    if (connErr) {
      console.error(`[${new Date().toLocaleString()}] Database connection failed:`, connErr);
      return res.status(500).json({ error: 'Database connection failed.' });
    }

    connection.query('SELECT * FROM users_gun WHERE username = ?', [username], (queryErr, rows) => {
      if (queryErr) {
        connection.release();
        console.error(`[${new Date().toLocaleString()}] Error fetching user:`, queryErr);
        return res.status(500).json({ error: 'An error occurred during login.' });
      }

      const user = rows[0];
      if (!user) {
        connection.release();
        console.log(`[${new Date().toLocaleString()}] Login failed for user: ${username} (not found)`);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      bcrypt.compare(password, user.password_hash, (bcryptErr, isMatch) => {
        connection.release();

        if (bcryptErr) {
          console.error(`[${new Date().toLocaleString()}] Error comparing password:`, bcryptErr);
          return res.status(500).json({ error: 'An error occurred during login.' });
        }

        if (isMatch) {
          console.log(`[${new Date().toLocaleString()}] Login successful for user: ${username}`);
          res.status(200).json({
            message: 'Login successful',
            token: 'fake-jwt-token-for-' + user.username,
            user: {
              username: user.username,
              name: user.name
            }
          });
        } else {
          console.log(`[${new Date().toLocaleString()}] Login failed for user: ${username} (wrong password)`);
          res.status(401).json({ error: 'Invalid username or password' });
        }
      });
    });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required.' });
  }

  const saltRounds = 10;
  bcrypt.hash(password, saltRounds, (hashErr, password_hash) => {
    if (hashErr) {
      console.error(`[${new Date().toLocaleString()}] Error hashing password:`, hashErr);
      return res.status(500).json({ error: 'Failed to hash password.' });
    }

    db.getConnection((connErr, connection) => {
      if (connErr) {
        console.error(`[${new Date().toLocaleString()}] Database connection failed:`, connErr);
        return res.status(500).json({ error: 'Database connection failed.' });
      }

      connection.query(
        'INSERT INTO users_gun (username, password_hash, name) VALUES (?, ?, ?)',
        [username, password_hash, name],
        (queryErr, results) => {
          connection.release();

          if (queryErr) {
            if (queryErr.code === 'ER_DUP_ENTRY') {
              console.error(`[${new Date().toLocaleString()}] Registration failed: Username already exists.`);
              return res.status(409).json({ error: 'Username already exists.' });
            }
            console.error(`[${new Date().toLocaleString()}] Error during registration:`, queryErr);
            return res.status(500).json({ error: 'An error occurred during registration.' });
          }

          console.log(`[${new Date().toLocaleString()}] User '${username}' (${name}) registered successfully.`);
          res.status(201).json({ message: 'User registered successfully.' });
        }
      );
    });
  });
});


app.get('/api/linens', (req, res) => {
  const query = 'SELECT LINEN_ID, LINEN_TYPE, LINEN_HEIGHT, LINEN_WIDTH, LINEN_MAX_CYCLE, LINEN_DESCRIPTION, LINEN_CREATED_DATE, LINEN_SIZE_CATEGORY FROM linens';

  db.query(query, (err, results) => {

    if (err) {
      console.error('Error fetching linen data:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch linen data.' });
    }
    
    console.log(`[${new Date().toLocaleString()}] Successfully fetched and sent ${results.length} linen items to the app.`);
    
    res.json(results);
  });
});         

app.get('/api/batch-in', (req, res) => {
  const query = 'SELECT BATCH_IN_ID, BATCH_IN_DATETIME FROM batch_in';
  db.query(query, (err, results) => {
    if (err) {
      console.error(`[${new Date().toLocaleString()}] Failed to fetch from batch_in:`, err);
      res.status(500).json({ success: false, message: 'Database query failed.' });
      return;
    }
    console.log(`[${new Date().toLocaleString()}] Successfully fetched ${results.length} batch-in records.`);
    res.json(results);
  });
});

app.get('/api/batch-in-details', (req, res) => {
  const query = 'SELECT BATCH_IN_ID, LINEN_ID FROM batch_in_details';
  db.query(query, (err, results) => {
    if (err) {
      console.error(`[${new Date().toLocaleString()}] Failed to fetch from batch_in_details:`, err);
      res.status(500).json({ success: false, message: 'Database query failed.' });
      return;
    }
    console.log(`[${new Date().toLocaleString()}] Successfully fetched ${results.length} batch-in-details records.`);
    res.json(results);
  });
});

app.post('/api/batch-out', (req, res) => {
    const { batch_out_id, epcs, storage_type, petugas_name } = req.body;

    if (!batch_out_id || !epcs || !Array.isArray(epcs) || epcs.length === 0 || !storage_type || !petugas_name) {
        return res.status(400).json({
            error: 'Invalid request body. Please provide batch_out_id, epcs, storage_type, and petugas_name.'
        });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Failed to get DB connection:`, err);
            return res.status(500).json({ error: 'Database connection failed.' });
        }

        // Use a counter to track completion of all async operations
        let totalOperations = epcs.length * 2; // Each EPC has 2 procedures
        let completedOperations = 0;
        let hasError = false;

        const done = (err) => {
            if (hasError) return;

            if (err) {
                hasError = true;
                console.error(`[${new Date().toLocaleString()}] Error executing stored procedure:`, err);
                connection.release(); 
                return res.status(500).json({ error: 'An error occurred during the save process.', details: err.message });
            }

            completedOperations++;
            if (completedOperations === totalOperations) {
                connection.release();
                console.log(`[${new Date().toLocaleString()}] All procedures (BATCH_OUT_READ & STORAGE_IN_READ) executed successfully.`);
                // broadcastDataUpdate();
                res.status(200).json({ message: 'Batch out and storage update process completed successfully.' });
            }
        };

        // 3. Loop through each EPC and execute both procedures
        epcs.forEach((epc) => {
            // Procedure 1: BATCH_OUT_READ
            connection.query('CALL BATCH_OUT_READ(?, ?)', [batch_out_id, epc], done);

            // Procedure 2: STORAGE_IN_READ
            // v_storage_pic is the petugas name
            connection.query('CALL STORAGE_IN_READ(?, ?, ?)', [epc, storage_type, petugas_name], done);
        });
    });
});

app.post('/api/storage-out', (req, res) => {
    const { epcs, petugas_name } = req.body;

    if (!epcs || !Array.isArray(epcs) || epcs.length === 0 || !petugas_name) {
        return res.status(400).json({
            error: 'Invalid request body. Please provide a non-empty array of epcs and a petugas_name.'
        });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Failed to get DB connection:`, err);
            return res.status(500).json({ error: 'Database connection failed.' });
        }

        let completed = 0;
        let hasError = false;

        const done = (err) => {
            if (hasError) return;

            if (err) {
                hasError = true;
                console.error(`[${new Date().toLocaleString()}] Error executing STORAGE_OUT_READ:`, err);
                connection.release();
                return res.status(500).json({ error: 'An error occurred during the storage out process.', details: err.message });
            }

            completed++;
            if (completed === epcs.length) {
                connection.release();
                console.log(`[${new Date().toLocaleString()}] All STORAGE_OUT_READ procedures executed successfully.`);
                // broadcastDataUpdate();
                res.status(200).json({ message: 'Storage out process completed successfully.' });
            }
        };

        // 3. Loop through each EPC and call the STORAGE_OUT_READ procedure
        epcs.forEach((epc) => {
            // The procedure's v_storage_pic maps to petugas_name
            connection.query('CALL STORAGE_OUT_READ(?, ?)', [epc, petugas_name], done);
        });
    });
});

app.get('/api/batch-usage', (req, res) => {
    const query = 'SELECT * FROM batch_usage';
    db.query(query, (err, results) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Failed to fetch from batch_usage:`, err);
            return res.status(500).json({ error: 'Failed to fetch batch usage data.' });
        }
        console.log(`[${new Date().toLocaleString()}] Successfully fetched ${results.length} batch usage records.`);
        res.json(results);
    });
});

// 2. Endpoint to get all records from the 'batch_usage_details' table
app.get('/api/batch-usage-details', (req, res) => {
    const query = 'SELECT * FROM batch_usage_details';
    db.query(query, (err, results) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Failed to fetch from batch_usage_details:`, err);
            return res.status(500).json({ error: 'Failed to fetch batch usage details.' });
        }
        console.log(`[${new Date().toLocaleString()}] Successfully fetched ${results.length} batch usage detail records.`);
        res.json(results);
    });
});

app.post('/api/batch-usage', (req, res) => {
    // 1. Get all the required data from the request body
    const {
        batch_usage_id,
        epcs,
        petugas_name,
        receiver_name,
        receiver_location
    } = req.body;

    // 2. Validate the incoming data
    if (!batch_usage_id || !epcs || !Array.isArray(epcs) || epcs.length === 0 || !petugas_name || !receiver_name || !receiver_location) {
        return res.status(400).json({
            error: 'Invalid request body. Please provide all required fields for batch usage.'
        });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Failed to get DB connection:`, err);
            return res.status(500).json({ error: 'Database connection failed.' });
        }

        let completed = 0;
        let hasError = false;

        const done = (err) => {
            if (hasError) return;

            if (err) {
                hasError = true;
                console.error(`[${new Date().toLocaleString()}] Error executing BATCH_USAGE_READ:`, err);
                connection.release();
                return res.status(500).json({ error: 'An error occurred during the batch usage process.', details: err.message });
            }

            completed++;
            if (completed === epcs.length) {
                connection.release();
                console.log(`[${new Date().toLocaleString()}] All BATCH_USAGE_READ procedures executed successfully for batch ${batch_usage_id}.`);
                // broadcastDataUpdate();
                res.status(200).json({ message: 'Batch usage process completed successfully.' });
            }
        };

        // 3. Loop through each EPC and call the BATCH_USAGE_READ procedure
        epcs.forEach((epc) => {
            // Map the variables to the procedure parameters
            connection.query(
                'CALL BATCH_USAGE_READ(?, ?, ?, ?, ?)',
                [batch_usage_id, epc, petugas_name, receiver_name, receiver_location],
                done
            );
        });
    });
});


// --- WS: 6. Start the HTTP server instead of the Express app ---
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is listening on the same port.`);
});
