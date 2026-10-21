"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Book,
  MessageSquare,
  ArrowRight,
  Plus,
  Upload,
  Brain,
  Search,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  documents: any[];
}

interface Chat {
  id: number;
  title: string;
  messages: any[];
}

interface Stats {
  knowledgeBases: number;
  chats: number;
}

export default function DashboardPage() {
  const { copy } = useI18n();
  const [stats, setStats] = useState<Stats>({ knowledgeBases: 0, chats: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [kbData, chatData] = await Promise.all([
          api.get("/api/knowledge-base"),
          api.get("/api/chat/"),
        ]);

        setStats({
          knowledgeBases: kbData.length,
          chats: chatData.length,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        if (error instanceof ApiError && error.status === 401) {
          return;
        }
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-12 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                {copy.dashboard.title}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 max-w-xl">
                {copy.dashboard.subtitle}
              </p>
            </div>
            <a
              href="/dashboard/knowledge/new"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              {copy.dashboard.newKb}
            </a>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-6">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-4">
                <Book className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-4xl font-bold text-slate-900 dark:text-white">
                  {stats.knowledgeBases}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {copy.dashboard.knowledgeBases}
                </p>
              </div>
            </div>
            <a
              href="/dashboard/knowledge"
              className="mt-6 flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
            >
              {copy.dashboard.viewAllKbs}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-6">
              <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-4">
                <MessageSquare className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-4xl font-bold text-slate-900 dark:text-white">
                  {stats.chats}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {copy.dashboard.chatSessions}
                </p>
              </div>
            </div>
            <a
              href="/dashboard/chat"
              className="mt-6 flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
            >
              {copy.dashboard.viewAllChats}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">
          {copy.dashboard.quickActions}
        </h2>
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          <a
            href="/dashboard/knowledge/new"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-md transition-all hover:border-blue-500 dark:hover:border-blue-500"
          >
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-4 mb-4">
              <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {copy.dashboard.createKb}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              {copy.dashboard.createKbDescription}
            </p>
          </a>

          <a
            href="/dashboard/knowledge"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-md transition-all hover:border-indigo-500 dark:hover:border-indigo-500"
          >
            <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-4 mb-4">
              <Upload className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {copy.dashboard.uploadDocuments}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              {copy.dashboard.uploadDocumentsDescription}
            </p>
          </a>

          <a
            href="/dashboard/chat/new"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm hover:shadow-md transition-all hover:border-purple-500 dark:hover:border-purple-500"
          >
            <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {copy.dashboard.startChatting}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              {copy.dashboard.startChattingDescription}
            </p>
          </a>
        </div>

        {/* Getting Started Guide */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
            <Search className="mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" />
            {copy.dashboard.howItWorks}
          </h2>
          <div className="space-y-6">
            <div className="flex items-start gap-6 p-6 rounded-xl bg-slate-50 dark:bg-slate-700/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                1
              </div>
              <div>
                <h3 className="font-medium text-lg text-slate-900 dark:text-white mb-2">
                  {copy.dashboard.stepCreateTitle}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {copy.dashboard.stepCreateDescription}
                </p>
                <a
                  href="/dashboard/knowledge/new"
                  className="mt-4 inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  {copy.dashboard.createNow}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-6 p-6 rounded-xl bg-slate-50 dark:bg-slate-700/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-semibold">
                2
              </div>
              <div>
                <h3 className="font-medium text-lg text-slate-900 dark:text-white mb-2">
                  {copy.dashboard.stepUploadTitle}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {copy.dashboard.stepUploadDescription}
                </p>
                <a
                  href="/dashboard/knowledge"
                  className="mt-4 inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                >
                  {copy.dashboard.uploadDocumentsCta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-6 p-6 rounded-xl bg-slate-50 dark:bg-slate-700/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white font-semibold">
                3
              </div>
              <div>
                <h3 className="font-medium text-lg text-slate-900 dark:text-white mb-2">
                  {copy.dashboard.stepChatTitle}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {copy.dashboard.stepChatDescription}
                </p>
                <a
                  href="/dashboard/chat/new"
                  className="mt-4 inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium"
                >
                  {copy.dashboard.startChattingCta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
