"use client";

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [email, setEmail] = useState('');

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, redirect to register page
    window.location.href = '/auth/register';
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="text-xl font-bold text-gray-900">TaskTrek</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            href="/auth/login"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Log In
          </Link>
          <Link 
            href="/auth/register"
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
          The complete project management <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">platform</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Organize projects, manage tasks with drag-and-drop boards, collaborate with your team, and track progress all in one place.
        </p>
        
        <div className="flex justify-center items-center gap-4 mb-4">
          <Link
            href="/auth/register"
            className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-8 py-4 rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all font-medium text-lg"
          >
            Start Managing Projects →
          </Link>
        </div>
        
        <p className="text-sm text-gray-500">Free to use • No credit card required</p>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage projects
          </h2>
          <p className="text-xl text-gray-600">
            TaskTrek brings together all the tools your team needs. <span className="font-medium">Built for real project management.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Kanban Boards */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Drag & Drop Kanban</h3>
              <p className="text-blue-100 mb-6">
                Visual project boards with seamless drag-and-drop. Move tasks between To Do, In Progress, and Done columns effortlessly.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Visual task management</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Real-time updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Status tracking</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>

          {/* Advanced Filtering */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Smart Filtering & Search</h3>
              <p className="text-purple-100 mb-6">
                Find exactly what you need with powerful filters. Search by status, priority, assignee, due dates, and more.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Multi-field filtering</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Real-time search</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Smart sorting</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>

          {/* Team Collaboration */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Team Collaboration</h3>
              <p className="text-green-100 mb-6">
                Add team members, assign tasks, track progress, and collaborate seamlessly with built-in commenting and notifications.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Task assignments</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Team comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Progress tracking</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>

          {/* Workspaces */}
          <div className="bg-gradient-to-br from-orange-500 to-pink-500 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🏢</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Multiple Workspaces</h3>
              <p className="text-orange-100 mb-6">
                Organize different teams and projects with separate workspaces. Switch between contexts effortlessly.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Workspace switching</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Team isolation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Project organization</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>

          {/* Task Management */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Complete Task Management</h3>
              <p className="text-indigo-100 mb-6">
                Create detailed tasks with priorities, due dates, descriptions, and attachments. Track everything that matters.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Priority levels</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Due date tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Rich descriptions</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>

          {/* Project Editing */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚙️</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Project Customization</h3>
              <p className="text-cyan-100 mb-6">
                Edit project details, manage team members, set statuses, and customize everything to fit your workflow.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Project editing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Member management</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Status tracking</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Demo Preview Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              See TaskTrek in action
            </h2>
            <p className="text-xl text-gray-600">
              Experience the power of visual project management
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border">
            <div className="grid md:grid-cols-3 gap-6">
              {/* To Do Column */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">To Do</h3>
                  <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm">3</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Design Homepage</span>
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">JD</div>
                      <span className="text-xs text-gray-500">Due: Jan 15</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Setup Database</span>
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">AS</div>
                      <span className="text-xs text-gray-500">Due: Jan 18</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* In Progress Column */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">In Progress</h3>
                  <span className="bg-blue-200 text-blue-700 px-2 py-1 rounded-full text-sm">2</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">API Development</span>
                      <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">MK</div>
                      <span className="text-xs text-gray-500">Due: Jan 20</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Done Column */}
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Done</h3>
                  <span className="bg-green-200 text-green-700 px-2 py-1 rounded-full text-sm">4</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border shadow-sm opacity-75">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium line-through">Project Planning</span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">Low</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs">RP</div>
                      <span className="text-xs text-gray-500">Completed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                ✨ Drag and drop tasks between columns • Filter by assignee, priority, or due date • Real-time collaboration
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-900 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">
                Built for teams that get things done
              </h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-bold text-white">100+</div>
                  <div className="text-gray-400">Projects managed</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">1K+</div>
                  <div className="text-gray-400">Tasks completed</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">50+</div>
                  <div className="text-gray-400">Teams organized</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">24/7</div>
                  <div className="text-gray-400">Always available</div>
                </div>
              </div>
              
              <Link 
                href="/auth/register"
                className="inline-block mt-8 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all"
              >
                Start your first project →
              </Link>
            </div>
            
            <div className="relative">
              <div className="w-full h-64 bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-orange-500/30">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">🚀</span>
                  </div>
                  <div className="text-white font-semibold">Project Success</div>
                  <div className="text-gray-300 text-sm">Delivered on time, every time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="bg-gradient-to-r from-orange-500 to-pink-500 py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Getting started is simple
          </h2>
          <p className="text-orange-100 mb-12 text-xl">
            Set up your first project in minutes and start collaborating with your team
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Create Your Workspace</h3>
              <p className="text-orange-100 text-sm">
                Set up your workspace and invite team members to collaborate on projects together.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Add Your Projects</h3>
              <p className="text-orange-100 text-sm">
                Create projects, add tasks with priorities and due dates, and organize everything visually.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Track Progress</h3>
              <p className="text-orange-100 text-sm">
                Use drag-and-drop boards, filters, and real-time updates to keep everything on track.
              </p>
            </div>
          </div>
          
          <div className="mt-12">
            <Link 
              href="/auth/register"
              className="inline-block bg-white text-orange-500 px-8 py-4 rounded-xl hover:bg-gray-100 transition-all font-bold text-lg"
            >
              Start Your First Project →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-lg font-bold text-gray-900">The app, for work.</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <span>© 2025 TaskTrek</span>
              <Link href="#" className="hover:text-gray-900">Security</Link>
              <Link href="#" className="hover:text-gray-900">Privacy</Link>
              <Link href="#" className="hover:text-gray-900">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
