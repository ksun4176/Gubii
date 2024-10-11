# Gubii Database
The database for Gubii. Here you can update the database schema or build out a test database for yourself.

## Contributing
### To create a test database:
1. Duplicate `.env.example` to `.env` and fill in the variables
2. Run `npm install`
3. Update your database schema using `npm run migrate`
4. If your database does not autopopulate with data, run `npx prisma db seed`
   NOTE: If there are issues, you can check if calling `npm run postmigrate` will fix it

### To update the database schema:
1. Make changes in `prisma/schema.prisma`
4. Create a new migration using `npm run migrate -- --name <name-your-update>`
3. If you need to update seed data, do so in `prisma/seed/seed.ts`
4. Populate with new seed using `npx prisma db seed`
   NOTE: If there are issues, you can check if calling `npm run postmigrate` will fix it

### To update the AWS RDS:
1. You will need the key in `../jumpbox-key` from ME
2. Call `ssh -i ../jumpbox-key -f -N -L <local-port-you-connect-to>:<rds-endpoint>:<rds:listening-port> ec2-user@<bastion-endpoint> -v` to create an SSH tunnel
3. Update `.env` to localhost:<local-port-you-connect-to>
4. Update the database schema using `npm run migrate`

## Technical Details
This executable is built in Node.js.
Some noteable node packages are Prisma.
The languages we are using are TypeScript.