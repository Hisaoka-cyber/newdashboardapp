import React, { useState } from 'react';
import { FileText, Send, CheckSquare, Calendar, Users, ListChecks, HardDrive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';

interface Template {
    id: string;
    title: string;
    recipients: string[];
    subject: string;
    body: string;
    subtasks: string[];
}

const templates: Template[] = [
    {
        id: 'improvement',
        title: '改善活動推進委員会',
        recipients: [
            'daisuke_miyamoto@saimiya.com',
            '"fumie_sonobe@saimiya.com" <fumie_sonobe@saimiya.com>',
            'hitoshi_watarai@saimiya.com',
            'housyasen@saimiya.com',
            'satoru_muroi@saimiya.com',
            'takayoshi_ikeda@saimiya.com',
            'youichi_teduka@saimiya.com',
            'yukiko_nakajima@saimiya.com',
            'keigo_muroi@saimiya.com'
        ],
        subject: 'YYYYMMDD改善活動推進委員会',
        body: `YYYYMMDD改善活動推進委員会の議事録です\n久岡　裕明`,
        subtasks: [
            '改善活動推進委員会 資料作成',
            '改善活動推進委員会 会議出席',
            '改善活動推進委員会 議事録作成',
            '改善活動推進委員会 議事録送付・共有'
        ]
    },
    {
        id: 'support',
        title: '患者サポート部門会議',
        recipients: [
            'daisuke_miyamoto@saimiya.com',
            '"fumie_sonobe@saimiya.com" <fumie_sonobe@saimiya.com>',
            'hitoshi_watarai@saimiya.com',
            'housyasen@saimiya.com',
            'satoru_muroi@saimiya.com',
            'takayoshi_ikeda@saimiya.com',
            'youichi_teduka@saimiya.com',
            'yukiko_nakajima@saimiya.com',
            'keigo_muroi@saimiya.com'
        ],
        subject: 'YYYYMMDD患者サポート部門会議',
        body: `YYYYMMDD患者サービス部門会議の議事録です\n久岡　裕明`,
        subtasks: [
            '患者サポート部門会議 準備',
            '患者サポート部門会議 出席',
            '患者サポート部門会議 議事録作成',
            '患者サポート部門会議 配信'
        ]
    }
];

export const MeetingMinutesPage: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isAddingTasks, setIsAddingTasks] = useState(false);
    const [driveFileId, setDriveFileId] = useState<string | null>(null);
    const [driveTemplateLink, setDriveTemplateLink] = useState<string | null>(null);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [driveMimeType, setDriveMimeType] = useState<string | null>(null);

    React.useEffect(() => {
        if (isSignedIn && selectedTemplate) {
            findDriveTemplate();
        }
    }, [isSignedIn, selectedTemplate]);

    const findDriveTemplate = async () => {
        if (!selectedTemplate) return;
        try {
            // Helper function to find by name and optional parent
            const searchFile = async (name: string, parentId?: string) => {
                let query = `name = '${name}' and trashed = false`;
                if (parentId) query += ` and '${parentId}' in parents`;
                const response = await (gapi.client as any).drive.files.list({
                    q: query,
                    fields: 'files(id, webViewLink, mimeType)',
                    pageSize: 1
                });
                return response.result.files?.[0];
            };

            const templateName = selectedTemplate.id === 'improvement'
                ? '改善活動推進委員会(テンプレート).docx'
                : '患者サポート部門会議（テンプレート）.docx';

            // 1. Try specific path navigation first
            let file = null;
            try {
                const findFolderId = async (name: string, pId: string = 'root') => {
                    const res = await (gapi.client as any).drive.files.list({
                        q: `name = '${name}' and '${pId}' in parents and trashed = false`,
                        fields: 'files(id)'
                    });
                    return res.result.files?.[0]?.id;
                };

                const workFolderId = await findFolderId('職場の仕事');
                if (workFolderId) {
                    const deptFolderId = await findFolderId('課内業務', workFolderId);
                    if (deptFolderId) {
                        const committeeFolderId = await findFolderId('改善活動推進委員会', deptFolderId);
                        if (committeeFolderId) {
                            file = await searchFile(templateName, committeeFolderId);
                        }
                    }
                }
            } catch (e) {
                console.warn('Path navigation failed, falling back to global search:', e);
            }

            // 2. Global fallback search
            if (!file) {
                file = await searchFile(templateName);
            }

            if (file) {
                setDriveTemplateLink(file.webViewLink);
                setDriveFileId(file.id);
                setDriveMimeType(file.mimeType);
            } else {
                setDriveFileId(null);
                setDriveTemplateLink(null);
            }
        } catch (error) {
            console.error('Error finding Drive template:', error);
        }
    };

    const handleComposeEmail = (template: Template) => {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const subject = template.subject.replace('YYYYMMDD', today);
        const body = encodeURIComponent(template.body);
        const to = template.recipients.join(',');

        // Use Gmail direct URL for better control
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(subject)}&body=${body}`;
        window.open(gmailUrl, '_blank');
    };

    const handleCreateDraft = async (template: Template) => {
        if (!driveFileId) {
            alert('Template file not found in Drive.');
            return;
        }

        setIsSendingEmail(true);
        try {
            const isGoogleDoc = driveMimeType === 'application/vnd.google-apps.document';
            let fileData = '';
            let fileName = '';
            let contentType = '';
            let docText = '';

            const todayObj = new Date();
            const todayStr = todayObj.toISOString().split('T')[0].replace(/-/g, '');

            if (isGoogleDoc) {
                // 1. Export as Text to extract date
                const textResponse = await (gapi.client as any).drive.files.export({
                    fileId: driveFileId,
                    mimeType: 'text/plain'
                });
                docText = textResponse.result || textResponse.body || '';

                // 2. Export as PDF
                const exportResponse = await (gapi.client as any).drive.files.export({
                    fileId: driveFileId,
                    mimeType: 'application/pdf'
                });

                // Convert binary response string to base64 safely
                const body = exportResponse.body || '';
                let binary = '';
                for (let i = 0; i < body.length; i++) {
                    binary += String.fromCharCode(body.charCodeAt(i) & 0xff);
                }
                fileData = btoa(binary);
                fileName = `${template.title}(議事録)_${todayStr}.pdf`;
                contentType = 'application/pdf';
            } else if (driveMimeType?.includes('officedocument.wordprocessingml.document')) {
                // For .docx, we need to convert to Google Doc first to export as PDF
                console.log('Converting docx to PDF via temporary Google Doc...');

                // 1. Create a temporary Google Doc copy
                const copyResponse = await (gapi.client as any).drive.files.copy({
                    fileId: driveFileId,
                    resource: {
                        mimeType: 'application/vnd.google-apps.document',
                        name: `TEMP_CONVERT_${todayStr}`
                    }
                });
                const tempId = copyResponse.result.id;

                try {
                    // 2. Extract text
                    const textResponse = await (gapi.client as any).drive.files.export({
                        fileId: tempId,
                        mimeType: 'text/plain'
                    });
                    docText = textResponse.result || textResponse.body || '';

                    // 3. Export the temp Google Doc as PDF
                    const exportResponse = await (gapi.client as any).drive.files.export({
                        fileId: tempId,
                        mimeType: 'application/pdf'
                    });

                    const body = exportResponse.body || '';
                    let binary = '';
                    for (let i = 0; i < body.length; i++) {
                        binary += String.fromCharCode(body.charCodeAt(i) & 0xff);
                    }
                    fileData = btoa(binary);
                    fileName = `${template.title}(議事録)_${todayStr}.pdf`;
                    contentType = 'application/pdf';
                } finally {
                    // 4. Always delete the temporary file
                    await (gapi.client as any).drive.files.delete({
                        fileId: tempId
                    });
                }
            } else {
                // Fallback for other files (fetch media directly)
                const fileResponse = await (gapi.client as any).drive.files.get({
                    fileId: driveFileId,
                    alt: 'media'
                });
                const body = fileResponse.body || '';
                let binary = '';
                for (let i = 0; i < body.length; i++) {
                    binary += String.fromCharCode(body.charCodeAt(i) & 0xff);
                }
                fileData = btoa(binary);
                fileName = `${template.title}(議事録)_${todayStr}.docx`;
                contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }

            // Extract Date from docText
            const y_now = todayObj.getFullYear();
            const m_now = String(todayObj.getMonth() + 1).padStart(2, '0');
            const d_now = String(todayObj.getDate()).padStart(2, '0');

            let meetingDateCompact = `${y_now}${m_now}${d_now}`;

            const dateMatch = docText.match(/(\d{4})[年/]\s*(\d{1,2})\s*[月/]\s*(\d{1,2})\s*日?/);
            if (dateMatch) {
                const y = dateMatch[1];
                const m = dateMatch[2].padStart(2, '0');
                const d = dateMatch[3].padStart(2, '0');
                meetingDateCompact = `${y}${m}${d}`;
            }

            const subject = template.subject.replace('YYYYMMDD', meetingDateCompact);
            const to = template.recipients.join(', ');
            const body = template.body.replace('YYYYMMDD', meetingDateCompact);

            const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
            const encodedBody = btoa(unescape(encodeURIComponent(body)));

            const boundary = "__WORKPAL_BOUNDARY__";
            const rawMessage = [
                `To: ${to}`,
                `Subject: ${encodedSubject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset="UTF-8"',
                'Content-Transfer-Encoding: base64',
                '',
                encodedBody,
                '',
                `--${boundary}`,
                `Content-Type: ${contentType}`,
                'Content-Transfer-Encoding: base64',
                `Content-Disposition: attachment; filename="${fileName}"`,
                '',
                fileData,
                '',
                `--${boundary}--`
            ].join('\r\n');

            const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await (gapi.client as any).gmail.users.drafts.create({
                userId: 'me',
                resource: {
                    message: {
                        raw: encodedMessage
                    }
                }
            });

            const messageId = response.result.message.id;

            // Open the created draft in a new tab
            const draftUrl = `https://mail.google.com/mail/#inbox?compose=${messageId}`;
            window.open(draftUrl, '_blank');

            alert('Gmail draft created successfully with the PDF attachment!');
        } catch (error: any) {
            console.error('Detailed Draft Creation Error:', error);
            const errorMsg = error?.result?.error?.message || error?.message || 'Unknown error';
            alert(`Failed to create draft: ${errorMsg}\n\nPlease ensure you have signed in again to grant the new "Drafts" permission.`);
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleAddToTodo = async (template: Template) => {
        if (!isSignedIn) {
            alert('Please sign in to add tasks.');
            return;
        }

        setIsAddingTasks(true);
        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 1 });
            const tasklistId = listResponse.result.items[0].id;

            for (const title of template.subtasks) {
                await (gapi.client as any).tasks.tasks.insert({
                    tasklist: tasklistId,
                    resource: {
                        title: title,
                        status: 'needsAction'
                    }
                });
            }
            alert('Tasks successfully added to your To-Do list!');
        } catch (error) {
            console.error('Error adding tasks:', error);
            alert('Failed to add tasks. Please try again.');
        } finally {
            setIsAddingTasks(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header>
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <FileText className="w-8 h-8" />
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">議事録テンプレート</h2>
                </div>
                <p className="text-zinc-500">課内業務の議事録作成と共有ワークフローを効率化します。</p>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Template List */}
                <div className="xl:col-span-1 space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 lg:px-0">Templates</h3>
                    <div className="grid grid-cols-2 xl:grid-cols-1 gap-4">
                        {templates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                className={`w-full text-left p-4 sm:p-6 rounded-3xl border transition-all duration-300 ${selectedTemplate?.id === template.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-blue-500/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <FileText className={selectedTemplate?.id === template.id ? 'text-white' : 'text-blue-500'} size={18} />
                                    <Calendar size={14} className="opacity-50" />
                                </div>
                                <h4 className="font-bold text-sm sm:text-lg mb-1 leading-tight">{template.title}</h4>
                                <p className={`text-[10px] sm:text-xs ${selectedTemplate?.id === template.id ? 'text-blue-100' : 'text-zinc-500'}`}>
                                    {template.subtasks.length} tasks
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preview & Actions */}
                <div className="xl:col-span-3">
                    {selectedTemplate ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px] lg:min-h-[800px]">
                            <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-800/20">
                                <div>
                                    <h3 className="font-black text-lg sm:text-xl">{selectedTemplate.title}</h3>
                                    <div className="flex items-center gap-4 mt-1 text-[10px] sm:text-xs text-zinc-500">
                                        <span className="flex items-center gap-1"><Users size={12} /> {selectedTemplate.recipients.length} recipients</span>
                                        <span className="flex items-center gap-1"><ListChecks size={12} /> {selectedTemplate.subtasks.length} subtasks</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    {driveTemplateLink && (
                                        <a
                                            href={driveTemplateLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                                        >
                                            <HardDrive size={14} />
                                            Drive
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleAddToTodo(selectedTemplate)}
                                        disabled={isAddingTasks}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    >
                                        <CheckSquare size={14} />
                                        To-Do
                                    </button>
                                    <button
                                        onClick={() => handleComposeEmail(selectedTemplate)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        <Send size={14} />
                                        Compose
                                    </button>
                                    <button
                                        onClick={() => handleCreateDraft(selectedTemplate)}
                                        disabled={isSendingEmail}
                                        className="w-full sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                    >
                                        {isSendingEmail ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                        Draft with PDF
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
                                <div className="grid grid-cols-1 gap-8">
                                    <section className="space-y-6">
                                        <div>
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Minutes Editor (Google Doc)</h5>
                                            {driveFileId ? (
                                                <div className="aspect-[1/1.4] lg:aspect-auto lg:h-[700px] w-full bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-2xl">
                                                    <iframe
                                                        src={`https://docs.google.com/document/d/${driveFileId}/edit`}
                                                        width="100%"
                                                        height="100%"
                                                        style={{ border: 0 }}
                                                        title="Template Editor"
                                                        className="opacity-100"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 italic text-sm text-zinc-400 text-center animate-pulse">
                                                    Finding template in Drive...
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Workflow Tasks</h5>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {selectedTemplate.subtasks.map((task, index) => (
                                                    <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-[10px]">
                                                        <div className="w-5 h-5 min-w-[20px] rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[10px] font-black text-blue-600">
                                                            {index + 1}
                                                        </div>
                                                        <span className="truncate">{task}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div >
                                    </section>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl p-12 text-center">
                            <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-full mb-6 italic">
                                <FileText size={48} className="opacity-20" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Select a template</h3>
                            <p className="max-w-xs">Template to see preview and take actions to automate your workflow.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
