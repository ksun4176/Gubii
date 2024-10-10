# Gubii Database
The database for Gubii. Here you can update the database schema or build out a test database for yourself.

## Contributing
### To create a test database:
1. Duplicate `.env.example` to `.env` and fill in the variables
2. Run `npm install`
3. Update your database schema using `npm run migrate`
4. If your database does not autopopulate with data, run `npx prisma db seed`

### To update the database schema:
1. Make changes in `prisma/schema.prisma`
2. If you need to update seed data, do so in `prisma/seed/seed.ts`
3. Create a new migration using `npm run migrate -- --name {name your update}`

## Technical Details
This executable is built in Node.js.
Some noteable node packages are Prisma.
The languages we are using are TypeScript.