//Fonksiyonlar
import { query } from "../config/db.js";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";

export const resolvers = {
  Query: {
    hello: () => "Merhaba Secure Vault! 🏦",

    getUsers: async () => {
      try {
        const res = await query("SELECT id, username, email, created_at FROM users");
        return res.rows || [];
      } catch (error) {
        console.error("Database error in getUsers:", error);
        return [];
      }
    },

    getWallet: async (_, { userId }) => {
      try {
        const res = await query("SELECT * FROM wallets WHERE user_id = $1", [userId]);
        return res.rows[0] || null;
      } catch (error) {
        console.error("Database error in getWallet:", error);
        return null;
      }
    },

    getTransaction: async (_, { userId }) => {
      try {
        const res = await query(
          `
          SELECT * FROM transactions 
          WHERE source_wallet_id IN (SELECT id FROM wallets WHERE user_id = $1)
          OR destination_wallet_id IN (SELECT id FROM wallets WHERE user_id = $1)
          ORDER BY created_at DESC
        `,
          [userId]
        );
        return res.rows || [];
      } catch (error) {
        console.error("Database error in getTransaction:", error);
        return [];
      }
    },
  },
  Mutation: {
    createUser: async (_, args) => {
      const { username, email, password } = args;

      if (!username || !email || !password) {
        throw new Error("All fields (username, email, password) are required.");
      }

      if (username.length < 3 || username.length > 50) {
        throw new Error("Username must be between 3 and 50 characters.");
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error("Username can only contain letters, numbers, and underscores.");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Invalid email format.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      const isUsernameTaken = await query("SELECT id FROM users WHERE username = $1", [username]);
      if (isUsernameTaken.rows.length > 0) {
        throw new Error("Username is already taken.");
      }

      const emailCheck = await query("SELECT id FROM users WHERE email = $1", [email]);
      if (emailCheck.rows.length > 0) {
        throw new Error("Email is already registered.");
      }

      const client = await pool.connect();

      try {
        await query("BEGIN");

        const salt = await bcrypt.genSalt(12); // Daha güvenli salt
        const hashedPassword = await bcrypt.hash(password, salt);

        const userInsertQuery = `
          INSERT INTO users (username, email, password_hash, created_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING id, username, email, created_at;
        `;

        const userResult = await client.query(userInsertQuery, [username, email, hashedPassword]);
        const newUser = userResult.rows[0];

        //Kullanici icin cuzdan
        const walletInsertQuery = `
          INSERT INTO wallets (user_id, balance, currency, created_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING *;
        `;

        await client.query(walletInsertQuery, [newUser.id, 0.0, "USD"]);

        // Transaction commit
        await client.query("COMMIT");

        console.log(`✅ New user created: ${username} (${email})`);

        // Password'u response'dan çıkar
        const { password: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Database error in createUser:", error);
        throw new Error(`Failed to create user: ${error.message}`);
      } finally {
        client.release(); //Isimiz bittikten sonra baglantiyi serbest birakiyoruz
      }
    },

    transferMoney: async (_, { senderId, receiverId, amount }) => {
      if (amount <= 0) {
        throw new Error("Transfer must be greater than zero");
      }

      if (senderId === receiverId) {
        throw new Error("Sender and receiver cannot be the same");
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const senderRes = await client.query("SELECT id, balance, version FROM wallets WHERE user_id = $1", [senderId]);

        const senderWallet = senderRes.rows[0];

        if (!senderWallet) throw new Error("Sender wallet not found");

        if (parseFloat(senderWallet.balance) < amount) {
          throw new Error("Insufficient funds in sender's wallet");
        }

        const receiverRes = await client.query("SELECT id, balance, version FROM wallets WHERE user_id = $1", [
          receiverId,
        ]);

        const receiverWallet = receiverRes.rows[0];
        if (!receiverWallet) throw new Error("Receiver wallet not found");

        const updateSenderText = `
          UPDATE wallets
          SET balance = balance - $1, version = version + 1
          WHERE id = $2 AND version = $3
          RETURNING id, balance;
        `;

        //Yukarda $1, $2, $3 olarak belirttigimiz yerlere parametrelerde sirasiyla veriyoruz
        const updateSenderRes = await client.query(updateSenderText, [amount, senderWallet.id, senderWallet.version]);

        if (updateSenderRes.rowCount === 0) {
          throw new Error("Conflict detected! Please try again.");
        }

        const updateReceiverText = `
          UPDATE wallets
          SET balance = balance + $1, version = version + 1
          WHERE id = $2
          RETURNING id, balance;
        `;

        await client.query(updateReceiverText, [amount, receiverWallet.id]);

        const insertTransactionText = `
          INSERT INTO transactions (source_wallet_id, destination_wallet_id, amount, status)
          VALUES ($1, $2, $3, 'COMPLETED')
          RETURNING *;
        `;

        const transactionRes = await client.query(insertTransactionText, [senderWallet.id, receiverWallet.id, amount]);

        await client.query("COMMIT");

        console.log(`Transfer Successful: ${amount} from ${senderId} to ${receiverId}`);

        return {
          success: true,
          message: "Transfer completed successfully",
          transaction: transactionRes.rows[0],
        };
      } catch (error) {
        await client.query("ROLLBACK");
        console.log(`❌ Transfer Failed: `, error.message);

        return {
          success: false,
          message: error.message,
          transaction: null,
        };
      } finally {
        client.release();
      }
    },
  },

  User: {
    wallet: async (parent) => {
      const res = await query("SELECT * FROM wallets WHERE user_id = $1", [parent.id]);
      return res.rows[0];
    },
  },
};
