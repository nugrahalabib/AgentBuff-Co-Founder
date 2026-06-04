-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('gemini', 'openai', 'openai_codex');

-- CreateEnum
CREATE TYPE "CredType" AS ENUM ('api_key', 'oauth_token');

-- CreateEnum
CREATE TYPE "CredStatus" AS ENUM ('active', 'invalid', 'revoked');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'researching', 'planning', 'branding', 'documenting', 'complete');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('go', 'refine', 'reconsider');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('proposal', 'pitch_deck');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'id',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ByokCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "credType" "CredType" NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "CredStatus" NOT NULL DEFAULT 'active',
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProfile" (
    "userId" TEXT NOT NULL,
    "sector" TEXT,
    "stage" TEXT,
    "primaryGoal" TEXT,
    "budgetBand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ideaText" TEXT NOT NULL,
    "sector" TEXT,
    "geography" TEXT,
    "stage" TEXT,
    "primaryGoal" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "contextCacheId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validationScore" INTEGER NOT NULL,
    "recommendation" "Recommendation" NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "summary" TEXT,
    "recommendationReason" TEXT,
    "market" JSONB,
    "competitors" JSONB,
    "pricing" JSONB,
    "costs" JSONB,
    "risks" JSONB,
    "resources" JSONB,
    "citations" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "isGrounded" BOOLEAN NOT NULL DEFAULT false,
    "groundingQueryCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePath" TEXT,
    "interactionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "inputs" JSONB NOT NULL,
    "financials" JSONB NOT NULL,
    "scenarios" JSONB,
    "narrative" JSONB,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "selectedName" TEXT,
    "strategy" JSONB,
    "naming" JSONB,
    "voice" JSONB,
    "visualTokens" JSONB,
    "assets" JSONB,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "templateId" TEXT,
    "theme" TEXT,
    "contentJson" JSONB NOT NULL,
    "brandTokensRef" TEXT,
    "assetRefs" JSONB,
    "htmlRef" TEXT,
    "pdfRef" TEXT,
    "pageCount" INTEGER,
    "renderStatus" TEXT,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "modelUsed" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "groundedQueries" INTEGER,
    "imagesGenerated" INTEGER,
    "estCostBand" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "tokenHash" TEXT,
    "tokenPrefix" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpAuditLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "argsHash" TEXT,
    "resultStatus" TEXT NOT NULL,
    "quotaEstimate" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFederation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKeyRef" TEXT,
    "secretRef" TEXT,
    "redirectAllowlist" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerFederation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ByokCredential_userId_idx" ON "ByokCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ByokCredential_userId_provider_key" ON "ByokCredential"("userId", "provider");

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchReport_projectId_key" ON "ResearchReport"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlan_projectId_key" ON "BusinessPlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_projectId_key" ON "BrandKit"("projectId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent"("userId");

-- CreateIndex
CREATE INDEX "UsageEvent_projectId_idx" ON "UsageEvent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "McpClient_oauthClientId_key" ON "McpClient"("oauthClientId");

-- CreateIndex
CREATE UNIQUE INDEX "McpClient_tokenHash_key" ON "McpClient"("tokenHash");

-- CreateIndex
CREATE INDEX "McpClient_ownerUserId_idx" ON "McpClient"("ownerUserId");

-- CreateIndex
CREATE INDEX "McpAuditLog_clientId_idx" ON "McpAuditLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFederation_partnerId_key" ON "PartnerFederation"("partnerId");

-- AddForeignKey
ALTER TABLE "ByokCredential" ADD CONSTRAINT "ByokCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProfile" ADD CONSTRAINT "OnboardingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlan" ADD CONSTRAINT "BusinessPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpClient" ADD CONSTRAINT "McpClient_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpAuditLog" ADD CONSTRAINT "McpAuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "McpClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

