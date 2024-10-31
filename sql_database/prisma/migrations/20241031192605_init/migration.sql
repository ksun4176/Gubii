-- CreateTable
CREATE TABLE `channel_purpose` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discord_id` VARCHAR(255) NOT NULL,
    `channel_type` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,
    `guild_id` INTEGER NULL,

    UNIQUE INDEX `uc_channel_purpose`(`channel_type`, `server_id`, `guild_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channel_purpose_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `game` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `uc_game`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guild` (
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
CREATE TABLE `guild_applicant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `guild_id` INTEGER NOT NULL,
    `game_id` INTEGER NOT NULL,
    `server_id` INTEGER NOT NULL,

    UNIQUE INDEX `uc_guild_applicant`(`user_id`, `game_id`, `server_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guild_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guild_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `guild_id` INTEGER NOT NULL,
    `event_id` INTEGER NOT NULL,
    `text` LONGTEXT NOT NULL,
    `channel_id` VARCHAR(191) NULL,

    UNIQUE INDEX `uc_guild_message`(`server_id`, `guild_id`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `discord_id` VARCHAR(255) NULL,
    `is_premium` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uc_server`(`discord_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `server_id` INTEGER NOT NULL,
    `event_id` INTEGER NOT NULL,
    `text` LONGTEXT NOT NULL,
    `channel_id` VARCHAR(191) NULL,

    UNIQUE INDEX `uc_server_message`(`server_id`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
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
CREATE TABLE `user_relation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    UNIQUE INDEX `uc_user_relation`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
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
CREATE TABLE `user_role_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `channel_purpose` ADD CONSTRAINT `channel_purpose_type_fk` FOREIGN KEY (`channel_type`) REFERENCES `channel_purpose_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channel_purpose` ADD CONSTRAINT `channel_purpose_server_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channel_purpose` ADD CONSTRAINT `channel_purpose_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `guild`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild` ADD CONSTRAINT `guild_game_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild` ADD CONSTRAINT `guild_server_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_applicant` ADD CONSTRAINT `guild_applicant_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_applicant` ADD CONSTRAINT `guild_applicant_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `guild`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_applicant` ADD CONSTRAINT `guild_applicant_game_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_applicant` ADD CONSTRAINT `guild_applicant_server_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_message` ADD CONSTRAINT `g_server_message_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_message` ADD CONSTRAINT `guild_message_fk` FOREIGN KEY (`guild_id`) REFERENCES `guild`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guild_message` ADD CONSTRAINT `guild_message_event_fk` FOREIGN KEY (`event_id`) REFERENCES `guild_event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `server_message` ADD CONSTRAINT `server_message_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `server_message` ADD CONSTRAINT `server_message_event_fk` FOREIGN KEY (`event_id`) REFERENCES `server_event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_relation` ADD CONSTRAINT `user_relation_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_relation` ADD CONSTRAINT `user_relation_role_fk` FOREIGN KEY (`role_id`) REFERENCES `user_role`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_type_fk` FOREIGN KEY (`role_type`) REFERENCES `user_role_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_server_fk` FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_guild_fk` FOREIGN KEY (`guild_id`) REFERENCES `guild`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
