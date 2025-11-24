//Tip tanimlamalari
export const typeDefs = `

   # User Tipini tanimliyoruz (Like a db table)
   type User {
        id: ID!
        username: String!
        email: String!
        wallet: Wallet
   }

   type Wallet {
        id: ID!
        balance: Float!
        currency: String!
        user: User
   }

   type Transaction {
        id: ID!
        amount: Float!
        status: String!
        sourceWalletId: ID
        destinationWalletId: ID
   }
    
   type TransferResponse {
        success: Boolean!
        message: String!
        transaction: Transaction
   }

   # Sorgular (GET istekleri)
   type Query {
        hello: String
        getWallet(userId: ID!): Wallet
        getTransaction(userId: ID!): [Transaction]
        getUsers: [User]
   }

   # Degisiklikler (POST/PUT/DELETE istekleri)
   type Mutation {
        createUser(username: String!, email: String!, password: String!): User

        transferMoney(
            senderId: ID!,
            receiverId: ID!,
            amount: Float!
        ): TransferResponse!
   }
`;
