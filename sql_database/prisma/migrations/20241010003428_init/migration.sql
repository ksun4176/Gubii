-- CreateTable
CREATE TABLE `Channel_Purpose` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discord_id` VARCHAR(255) NOT NULL,
    `channel_type` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,
    `guild_id` INTEGER NULL,

    UNIQUE INDEX `uc_channel_purpose`(`channel_type`, `server_id`, `guild_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Channel_Purpose_Type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Game` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `uc_game`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guild` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `game_id` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,
    `guild_id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uc_guild`(`game_id`, `guild_id`, `server_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guild_Applicant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `guild_id` INTEGER NOT NULL,
    `game_id` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,

    UNIQUE INDEX `uc_guild_applicant`(`user_id`, `game_id`, `server_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guild_Application` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` LONGTEXT NOT NULL,
    `server_id` INTEGER NOT NULL,
    `game_id` INTEGER NOT NULL,

    UNIQUE INDEX `uc_guild_application`(`server_id`, `game_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Server` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `discord_id` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uc_server`(`discord_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `discord_id` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uc_user`(`discord_id`),
    UNIQUE INDEX `uc_user_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_Relation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    UNIQUE INDEX `uc_user_relation`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `role_type` INTEGER NULL,
    `server_id` INTEGER NOT NULL,
    `guild_id` INTEGER NULL,
    `discord_id` VARCHAR(255) NULL,

    UNIQUE INDEX `uc_user_role`(`discord_id`),
    UNIQUE INDEX `uc_user_role_2`(`role_type`, `server_id`, `guild_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_Role_Type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Channel_Purpose` ADD CONSTRAINT `channel_purpose_type_fk` FOREIGN KEY (`channel_type`) REFERENCES `Channel_Purpose_Type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Channel_Purpose` ADD CONSTRAINT `channel_purpose_server_fk` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Channel_Purpose` ADD CONSTRAINT `channel_purpose_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `Guild`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild` ADD CONSTRAINT `guild_game_fk` FOREIGN KEY (`game_id`) REFERENCES `Game`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild` ADD CONSTRAINT `guild_server_fk` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Applicant` ADD CONSTRAINT `guild_applicant_user_fk` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Applicant` ADD CONSTRAINT `guild_applicant_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `Guild`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Applicant` ADD CONSTRAINT `guild_applicant_game_fk` FOREIGN KEY (`game_id`) REFERENCES `Game`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Applicant` ADD CONSTRAINT `guild_applicant_server_fk` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Application` ADD CONSTRAINT `guild_application_server_fk` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guild_Application` ADD CONSTRAINT `guild_application_game_fk` FOREIGN KEY (`game_id`) REFERENCES `Game`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Relation` ADD CONSTRAINT `user_relation_user_fk` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Relation` ADD CONSTRAINT `user_relation_role_fk` FOREIGN KEY (`role_id`) REFERENCES `User_Role`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Role` ADD CONSTRAINT `user_role_type_fk` FOREIGN KEY (`role_type`) REFERENCES `User_Role_Type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Role` ADD CONSTRAINT `user_role_server_fk` FOREIGN KEY (`server_id`) REFERENCES `Server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Role` ADD CONSTRAINT `user_role_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `Guild`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
