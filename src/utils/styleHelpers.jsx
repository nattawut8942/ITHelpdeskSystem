// Use these color mappings across the application for consistency
import { Monitor, Laptop, Wifi, Key, Shield, Headphones, Factory, Briefcase, Database, LayoutDashboard, Wrench, MapPin, Paperclip } from 'lucide-react';
import React from 'react';

export const getDeviceTypeColor = (type) => {
    if (!type) {
        return {
            bg: 'bg-slate-100',
            text: 'text-slate-600',
            border: 'border-slate-200',
            gradient: 'from-slate-500 to-slate-600',
            hex: '#64748b'
        };
    }

    const t = type.toUpperCase().trim();

    if (t.includes('HARDWARE') || t.includes('MONITOR') || t.includes('SETUP') || t.includes('REPAIR')) {
        return {
            bg: 'bg-indigo-50/70',
            text: 'text-indigo-600',
            border: 'border-indigo-150',
            gradient: 'from-indigo-500 to-indigo-600',
            hex: '#4f46e5'
        };
    }
    if (t.includes('SOFTWARE') || t.includes('SYSTEM') || t.includes('PROGRAM')) {
        return {
            bg: 'bg-purple-50/70',
            text: 'text-purple-600',
            border: 'border-purple-150',
            gradient: 'from-purple-500 to-purple-600',
            hex: '#9333ea'
        };
    }
    if (t.includes('NETWORK') || t.includes('WIFI') || t.includes('INTERNET') || t.includes('PRINTER')) {
        return {
            bg: 'bg-sky-50/70',
            text: 'text-sky-600',
            border: 'border-sky-150',
            gradient: 'from-sky-500 to-sky-600',
            hex: '#0284c7'
        };
    }
    if (t.includes('ACCOUNT') || t.includes('ACCESS') || t.includes('KEY') || t.includes('PERMISSION')) {
        return {
            bg: 'bg-amber-50/70',
            text: 'text-amber-700',
            border: 'border-amber-150',
            gradient: 'from-amber-500 to-amber-600',
            hex: '#b45309'
        };
    }
    if (t.includes('SECURITY') || t.includes('SHIELD') || t.includes('ANTIVIRUS')) {
        return {
            bg: 'bg-rose-50/70',
            text: 'text-rose-600',
            border: 'border-rose-150',
            gradient: 'from-rose-500 to-rose-600',
            hex: '#e11d48'
        };
    }
    if (t.includes('RELOCATION') || t.includes('MOVE') || t.includes('MAP')) {
        return {
            bg: 'bg-teal-50/70',
            text: 'text-teal-600',
            border: 'border-teal-150',
            gradient: 'from-teal-500 to-teal-600',
            hex: '#0d9488'
        };
    }
    if (t.includes('PRODUCTION') || t.includes('FACTORY')) {
        return {
            bg: 'bg-emerald-50/70',
            text: 'text-emerald-600',
            border: 'border-emerald-150',
            gradient: 'from-emerald-500 to-emerald-600',
            hex: '#059669'
        };
    }
    if (t.includes('OFFICE') || t.includes('BRIEFCASE') || t.includes('SERVICE') || t.includes('REQUEST')) {
        return {
            bg: 'bg-fuchsia-50/70',
            text: 'text-fuchsia-600',
            border: 'border-fuchsia-150',
            gradient: 'from-fuchsia-500 to-fuchsia-600',
            hex: '#c026d3'
        };
    }

    return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        gradient: 'from-slate-550 to-slate-650',
        hex: '#475569'
    };
};

export const getRequestTypeIcon = (type) => {
    if (!type) return <LayoutDashboard className="w-4 h-4 text-slate-600" />;

    const { text } = getDeviceTypeColor(type);
    const t = type.toUpperCase().trim();

    if (t.includes('HARDWARE')) return <Monitor className={`w-4 h-4 ${text}`} />;
    if (t.includes('SOFTWARE')) return <Laptop className={`w-4 h-4 ${text}`} />;
    if (t.includes('NETWORK')) return <Wifi className={`w-4 h-4 ${text}`} />;
    if (t.includes('ACCOUNT') || t.includes('ACCESS')) return <Key className={`w-4 h-4 ${text}`} />;
    if (t.includes('SECURITY')) return <Shield className={`w-4 h-4 ${text}`} />;
    if (t.includes('SERVICE') || t.includes('REQUEST')) return <Headphones className={`w-4 h-4 ${text}`} />;
    if (t.includes('PRODUCTION')) return <Factory className={`w-4 h-4 ${text}`} />;
    if (t.includes('OFFICE')) return <Briefcase className={`w-4 h-4 ${text}`} />;
    if (t.includes('SYSTEM')) return <Database className={`w-4 h-4 ${text}`} />;

    // Fallbacks
    if (t.includes('SETUP')) return <Monitor className={`w-4 h-4 ${text}`} />;
    if (t.includes('REPAIR')) return <Wrench className={`w-4 h-4 ${text}`} />;
    if (t.includes('RELOCATION') || t.includes('MOVE')) return <MapPin className={`w-4 h-4 ${text}`} />;
    if (t.includes('PRINTER')) return <Paperclip className={`w-4 h-4 ${text}`} />;

    return <LayoutDashboard className={`w-4 h-4 ${text}`} />;
};

export const getBadgeStyle = (type) => {
    const { bg, text, border } = getDeviceTypeColor(type);
    return `${bg} ${text} ${border}`;
};

export const getColorGradient = (type) => {
    const { gradient } = getDeviceTypeColor(type);
    return gradient;
};

// For Recharts or other chart libraries
export const getChartColor = (type) => {
    const { hex } = getDeviceTypeColor(type);
    return hex;
};