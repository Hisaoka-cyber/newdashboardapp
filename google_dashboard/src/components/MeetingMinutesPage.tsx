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
        recipients: ['member1@example.com', 'member2@example.com'],
        subject: '【議事録】改善活動推進委員会_YYYYMMDD',
        body: `院内・委員会の業務報告書\n2026年MM月DD日\n報告者：久岡　裕明\n委員会等：改善活動推進委員会\n開催日：2026年MM月DD日\n\n【議事録の内容】\n\n\n【次回予定】\n次回　令和8年2月18日（水）　16:45～　南館研修室B2\n\n以上`,
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
        recipients: ['support-team@example.com'],
        subject: '【議事録】患者サポート部門会議_YYYYMMDD',
        body: `各位\n\nお疲れ様です。XXXXです。\n「患者サポート部門会議」の議事録を共有いたします。\n\n【日時】2026年MM月DD日（曜）\n【場所】カンファレンスルーム\n【出席者】敬称略\n\n【内容】\n1. 患者満足度調査の結果共有\n2. 個別事案の検討\n3. 運用ルールの見直し\n\n【アクションアイテム】\n・担当者：期限\n\n以上、よろしくお願いいたします。`,
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
    const [dynamicBody, setDynamicBody] = useState<string | null>(null);

    React.useEffect(() => {
        if (isSignedIn) {
            findDriveTemplate();
        }
    }, [isSignedIn]);

    const findDriveTemplate = async () => {
        try {
            // Helper function to find a folder by name and parent
            const findId = async (name: string, parentId: string = 'root') => {
                const response = await (gapi.client as any).drive.files.list({
                    q: `name = '${name}' and '${parentId}' in parents and trashed = false`,
                    fields: 'files(id)',
                    pageSize: 1
                });
                return response.result.files?.[0]?.id;
            };

            // Navigate through the folder structure
            const workFolderId = await findId('職場の仕事');
            if (!workFolderId) return;

            const deptFolderId = await findId('課内業務', workFolderId);
            if (!deptFolderId) return;

            const committeeFolderId = await findId('改善活動推進委員会', deptFolderId);
            if (!committeeFolderId) return;

            // Find the template file in the committee folder
            const response = await (gapi.client as any).drive.files.list({
                q: `name = '改善活動推進委員会(テンプレート).docx' and '${committeeFolderId}' in parents and trashed = false`,
                fields: 'files(id, name, webViewLink, mimeType)',
                pageSize: 1
            });

            const files = response.result.files;
            if (files && files.length > 0) {
                const file = files[0];
                setDriveTemplateLink(file.webViewLink);
                setDriveFileId(file.id);

                // Attempt to fetch text content for email composition
                if (file.mimeType === 'application/vnd.google-apps.document') {
                    try {
                        const exportResponse = await (gapi.client as any).drive.files.export({
                            fileId: file.id,
                            mimeType: 'text/plain'
                        });
                        setDynamicBody(exportResponse.result || exportResponse.body);
                    } catch (e) {
                        console.warn('Could not export Google Doc as text:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Error finding Drive template:', error);
        }
    };

    const handleComposeEmail = (template: Template) => {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const subject = template.subject.replace('YYYYMMDD', today);

        // Use dynamic body if template matches and dynamic content is available
        const bodyText = (template.id === 'improvement' && dynamicBody) ? dynamicBody : template.body;
        const body = encodeURIComponent(bodyText);
        const to = template.recipients.join(',');

        // Use Gmail direct URL for better control
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(subject)}&body=${body}`;
        window.open(gmailUrl, '_blank');
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Template List */}
                <div className="xl:col-span-1 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-2">Templates</h3>
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className={`w-full text-left p-6 rounded-3xl border transition-all duration-300 ${selectedTemplate?.id === template.id
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20'
                                : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-blue-500/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <FileText className={selectedTemplate?.id === template.id ? 'text-white' : 'text-blue-500'} size={20} />
                                <Calendar size={16} className="opacity-50" />
                            </div>
                            <h4 className="font-bold text-lg mb-1">{template.title}</h4>
                            <p className={`text-xs ${selectedTemplate?.id === template.id ? 'text-blue-100' : 'text-zinc-500'}`}>
                                {template.subtasks.length} tasks in workflow
                            </p>
                        </button>
                    ))}
                </div>

                {/* Preview & Actions */}
                <div className="xl:col-span-2">
                    {selectedTemplate ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full lg:min-h-[600px]">
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                                <div>
                                    <h3 className="font-black text-xl">{selectedTemplate.title}</h3>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                                        <span className="flex items-center gap-1"><Users size={12} /> {selectedTemplate.recipients.length} recipients</span>
                                        <span className="flex items-center gap-1"><ListChecks size={12} /> {selectedTemplate.subtasks.length} subtasks</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {selectedTemplate.id === 'improvement' && driveTemplateLink && (
                                        <a
                                            href={driveTemplateLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                                        >
                                            <HardDrive size={16} />
                                            Driveでテンプレートを開く
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleAddToTodo(selectedTemplate)}
                                        disabled={isAddingTasks}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    >
                                        {isAddingTasks ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <CheckSquare size={16} />
                                        )}
                                        To-Doに追加
                                    </button>
                                    <button
                                        onClick={() => handleComposeEmail(selectedTemplate)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        <Send size={16} />
                                        Gmailで作成
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-8 overflow-y-auto">
                                <div className="space-y-6">
                                    <section>
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Email Template</h5>
                                        {selectedTemplate.id === 'improvement' && driveFileId ? (
                                            <div className="aspect-[1/1.4] w-full bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-inner">
                                                <iframe
                                                    src={`https://docs.google.com/viewer?srcid=${driveFileId}&pid=explorer&efp=re_3&a=v&chrome=false&embedded=true`}
                                                    width="100%"
                                                    height="100%"
                                                    style={{ border: 0 }}
                                                    title="Template Preview"
                                                    className="opacity-90 grayscale-[0.2] contrast-125"
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 font-mono text-sm whitespace-pre-wrap">
                                                <div className="mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                                                    <span className="text-zinc-400">Subject:</span> {selectedTemplate.subject.replace('YYYYMMDD', 'YYYYMMDD')}
                                                </div>
                                                {selectedTemplate.body}
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Workflow Tasks</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {selectedTemplate.subtasks.map((task, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm">
                                                    <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[10px] font-black text-blue-600">
                                                        {index + 1}
                                                    </div>
                                                    {task}
                                                </div>
                                            ))}
                                        </div>
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
