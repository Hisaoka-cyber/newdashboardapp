import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Send, CheckSquare, Calendar, Users, ListChecks, HardDrive, Mic, Music, Sparkles, Copy, Trash2, Loader2, RefreshCw, Image, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        id: 'integration',
        title: '統合情報部門会議',
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
        subject: 'YYYYMMDD統合情報部門会議',
        body: `YYYYMMDD統合情報部門会議の議事録です\n久岡　裕明`,
        subtasks: [
            '統合情報部門会議 準備',
            '統合情報部門会議 出席',
            '統合情報部門会議 議事録作成',
            '統合情報部門会議 配信'
        ]
    }
];

export const MeetingMinutesPage: React.FC = () => {
    const { isSignedIn, geminiApiKey } = useAuth();
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isAddingTasks, setIsAddingTasks] = useState(false);
    const [driveFileId, setDriveFileId] = useState<string | null>(null);
    const [driveTemplateLink, setDriveTemplateLink] = useState<string | null>(null);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [driveMimeType, setDriveMimeType] = useState<string | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // Google Drive OCR states
    const [meetingFolderId, setMeetingFolderId] = useState<string | null>(null);
    const [folderImages, setFolderImages] = useState<any[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [isOcrRunning, setIsOcrRunning] = useState(false);
    const [ocrProgressText, setOcrProgressText] = useState<string>('');
    const [selectedImageId, setSelectedImageId] = useState<string>('');
    const [ocrResultText, setOcrResultText] = useState<string | null>(null);
    const [createdDocId, setCreatedDocId] = useState<string | null>(null);
    const [ocrOriginalText, setOcrOriginalText] = useState<string | null>(null);
    const [isOcrCorrecting, setIsOcrCorrecting] = useState(false);
    const [isShowingOriginalOcr, setIsShowingOriginalOcr] = useState(false);

    useEffect(() => {
        if (isSignedIn && selectedTemplate) {
            findDriveTemplate();
        }
    }, [isSignedIn, selectedTemplate]);

    const findDriveTemplate = async () => {
        if (!selectedTemplate) return;
        setMeetingFolderId(null);
        try {
            const folderName = selectedTemplate.id === 'improvement'
                ? '改善活動推進委員会'
                : '統合情報部門会議';

            const templateName = selectedTemplate.id === 'improvement'
                ? '改善活動推進委員会(テンプレート).docx'
                : '統合情報部門会議（テンプレート）.docx';

            // Helper to search for a file/folder by name
            const searchFile = async (name: string, parentId?: string) => {
                let query = `name = '${name}' and trashed = false`;
                if (parentId) query += ` and '${parentId}' in parents`;
                const res = await (gapi.client as any).drive.files.list({
                    q: query,
                    fields: 'files(id, webViewLink, mimeType)',
                    pageSize: 1
                });
                return res.result.files?.[0];
            };

            // --- STEP 1: Global folder search by exact name (most reliable) ---
            let folderId: string | null = null;
            try {
                const folderRes = await (gapi.client as any).drive.files.list({
                    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name, parents)',
                    pageSize: 5
                });
                const folders = folderRes.result.files || [];
                if (folders.length > 0) {
                    folderId = folders[0].id;
                    console.log(`[Drive] Found folder "${folderName}" with ID: ${folderId}`);
                } else {
                    console.warn(`[Drive] No folder found with name "${folderName}". Trying path navigation...`);
                }
            } catch (err) {
                console.error('[Drive] Global folder search failed:', err);
            }

            // --- STEP 2: Path navigation fallback ---
            if (!folderId) {
                try {
                    const findFolderByName = async (name: string, parentId?: string) => {
                        let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
                        if (parentId) q += ` and '${parentId}' in parents`;
                        const res = await (gapi.client as any).drive.files.list({ q, fields: 'files(id)' });
                        return res.result.files?.[0]?.id;
                    };
                    const workId = await findFolderByName('職場の仕事');
                    if (workId) {
                        const deptId = await findFolderByName('課内業務', workId);
                        if (deptId) {
                            const meetId = await findFolderByName(folderName, deptId);
                            if (meetId) folderId = meetId;
                        }
                    }
                } catch (e) {
                    console.warn('[Drive] Path navigation also failed:', e);
                }
            }

            if (folderId) {
                setMeetingFolderId(folderId);
            } else {
                console.error(`[Drive] Could not find folder: "${folderName}"`);
            }

            // --- Find template file ---
            let file = await searchFile(templateName, folderId || undefined);
            if (!file) file = await searchFile(templateName); // global fallback

            // If file found but still no folderId, derive from file's parent
            if (file && !folderId) {
                try {
                    const det = await (gapi.client as any).drive.files.get({ fileId: file.id, fields: 'parents' });
                    folderId = det.result.parents?.[0] || null;
                    if (folderId) setMeetingFolderId(folderId);
                } catch (_) {}
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
            console.error('[Drive] Error in findDriveTemplate:', error);
        }
    };

    // Debug: List all folders in Drive to help identify the correct folder name
    const debugListAllFolders = async () => {
        try {
            const res = await (gapi.client as any).drive.files.list({
                q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, parents)',
                pageSize: 50,
                orderBy: 'name'
            });
            const folders = res.result.files || [];
            if (folders.length === 0) {
                alert('Drive内にアクセス可能なフォルダが見つかりませんでした。\n\nサインインし直してから再試行してください。');
                return;
            }
            const names = folders.map((f: any) => f.name).join('\n');
            alert(`Drive内のフォルダ一覧 (${folders.length}件):\n\n${names}`);
        } catch (err: any) {
            const status = err?.status || err?.result?.error?.code;
            if (status === 401 || status === 403) {
                alert('認証エラー（401/403）:\nGoogleセッションが期限切れです。\n\n一度サインアウトして再度サインインしてください。');
            } else {
                alert('フォルダ一覧の取得に失敗しました。\nエラー: ' + (err?.result?.error?.message || err?.message || JSON.stringify(err)));
            }
        }
    };


    const fetchFolderImages = useCallback(async (folderId: string) => {
        setLoadingImages(true);
        try {
            const response = await (gapi.client as any).drive.files.list({
                q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/gif') and trashed = false`,
                fields: 'files(id, name, modifiedTime, thumbnailLink, webViewLink, mimeType)',
                orderBy: 'modifiedTime desc',
                pageSize: 15
            });
            const files = response.result.files || [];
            setFolderImages(files);
            if (files.length > 0) {
                setSelectedImageId(files[0].id);
            } else {
                setSelectedImageId('');
            }
        } catch (error: any) {
            const status = error?.status || error?.result?.error?.code;
            if (status === 401 || status === 403) {
                console.error('[Drive] Auth error fetching images. Token may be expired.');
                alert('認証エラー: Googleセッションが期限切れです。\nサインアウトして再度サインインしてください。');
            } else {
                console.error('Error fetching images in folder:', error);
            }
        } finally {
            setLoadingImages(false);
        }
    }, []);

    useEffect(() => {
        if (meetingFolderId) {
            fetchFolderImages(meetingFolderId);
        } else {
            setFolderImages([]);
            setSelectedImageId('');
        }
    }, [meetingFolderId, fetchFolderImages]);

    const handleOcrImage = async () => {
        if (!selectedImageId) {
            alert('画像を選択してください。');
            return;
        }
        if (!meetingFolderId) {
            alert('アップロード先のフォルダが見つかりません。');
            return;
        }

        setIsOcrRunning(true);
        setOcrProgressText('画像をダウンロード中...');
        try {
            const selectedImage = folderImages.find(f => f.id === selectedImageId);
            if (!selectedImage) {
                throw new Error('選択された画像の情報が見つかりません。');
            }
            
            const mimeType = selectedImage.mimeType || 'image/jpeg';
            const imageName = selectedImage.name;

            // Check for HEIC format and throw clear error
            if (mimeType.toLowerCase().includes('heic') || mimeType.toLowerCase().includes('heif') || imageName.toLowerCase().endsWith('.heic') || imageName.toLowerCase().endsWith('.heif')) {
                throw new Error('HEIC形式の画像はGoogle Drive OCRで直接処理できません。お手数ですが、画像をJPEGまたはPNGに変換し、フォルダへ再アップロードしてからお試しください。');
            }

            const nameWithoutExt = imageName.replace(/\.[^/.]+$/, "");
            const docName = `【文字起こし】${nameWithoutExt}`;

            // Step 1: Get an access token from gapi
            const token = gapi.auth.getToken();
            if (!token?.access_token) {
                throw new Error('アクセストークンが取得できませんでした。再度サインインしてください。');
            }
            const accessToken = token.access_token;

            // Step 2: Download the image directly from the Drive API (supports CORS)
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${selectedImageId}?alt=media`;
            console.log('[OCR] Downloading media from Drive API (CORS enabled):', downloadUrl);
            
            const downloadRes = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (!downloadRes.ok) {
                const errText = await downloadRes.text();
                throw new Error(`画像のダウンロードに失敗しました: ${downloadRes.status} ${errText}`);
            }
            
            const imageBlob = await downloadRes.blob();

            setOcrProgressText('Google Driveにアップロード中 (OCR変換)...');

            // Step 3: Upload using multipart related upload to convert to Google Doc
            const boundary = 'foo_bar_baz_boundary';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--\r\n`;

            const metadata = {
                name: docName,
                mimeType: 'application/vnd.google-apps.document',
                parents: [meetingFolderId]
            };

            const metadataPart = JSON.stringify(metadata);

            const multipartBody = new Blob([
                delimiter,
                'Content-Type: application/json; charset=UTF-8\r\n\r\n',
                metadataPart,
                delimiter,
                `Content-Type: ${mimeType}\r\n\r\n`,
                imageBlob,
                closeDelimiter
            ]);

            const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=ja';
            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            });

            if (!uploadRes.ok) {
                const errJson = await uploadRes.json().catch(() => ({}));
                const msg = (errJson as any)?.error?.message || uploadRes.statusText;
                const details = JSON.stringify((errJson as any)?.error || errJson, null, 2);
                throw new Error(`Googleドキュメントへの変換に失敗しました: ${uploadRes.status} ${msg}\n詳細: ${details}`);
            }

            const result = await uploadRes.json();
            if (result.id) {
                setOcrProgressText('文字起こしテキストを取得中...');
                const textResponse = await (gapi.client as any).drive.files.export({
                    fileId: result.id,
                    mimeType: 'text/plain'
                });
                const rawText = textResponse.result || textResponse.body || '';
                
                // Clean the text from carriage returns if any
                const cleanExtractedText = rawText.replace(/\r\n/g, '\n');
                
                setOcrResultText(cleanExtractedText);
                setCreatedDocId(result.id);
                setOcrProgressText('完了しました！');
                alert(`「${docName}」が作成され、文字起こしが完了しました！\n結果をアプリ内で確認できます。`);
            } else {
                throw new Error('新しいGoogleドキュメントのIDが返されませんでした。');
            }
        } catch (err: any) {
            console.error('OCR error:', err);
            const errMsg = err?.result?.error?.message || err?.message || String(err);
            alert(`OCR変換中にエラーが発生しました:\n${errMsg}`);
        } finally {
            setIsOcrRunning(false);
            setOcrProgressText('');
        }
    };

    const handleOcrCorrect = async () => {
        if (!ocrResultText) return;
        if (!geminiApiKey) {
            alert('Gemini APIキーが設定されていません。画面右上にある設定（歯車マーク）からAPIキーを入力してください。');
            return;
        }

        setIsOcrCorrecting(true);
        try {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1beta" });

            const prompt = `あなたは優秀な校正エディタです。以下の文章は画像からOCR（光学文字認識）で読み取ったテキストです。OCR特有の誤字・脱字、文字の読み間違い（例: 「1」と「l」や、類似の漢字の誤字）、不自然な位置での改行などを自然な日本語に修正・校正してください。

【重要ルール】
1. 元文章の意味や表現を勝手に改変したり、勝手に要約を加えたりしないでください。あくまで「誤字脱字の修正」と「表記揺れの補正」のみを行ってください。
2. 解説、導入文、結びの文（「以下のように修正しました」など）などの余計なテキストは一切追加せず、校正・修正後のテキストのみを出力してください。

[対象の文章]
${ocrResultText}`;

            const response = await model.generateContent(prompt);
            const resultText = response.response.text();
            
            if (resultText && resultText.trim().length > 0) {
                // Save original text if not already saved
                if (!ocrOriginalText) {
                    setOcrOriginalText(ocrResultText);
                }
                setOcrResultText(resultText.trim());
                setIsShowingOriginalOcr(false);
            } else {
                throw new Error('AIから校正内容を取得できませんでした。');
            }
        } catch (error: any) {
            console.error('Gemini OCR correction error:', error);
            alert(`AI校正中にエラーが発生しました:\n${error.message || String(error)}`);
        } finally {
            setIsOcrCorrecting(false);
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

    const handleSummarize = async () => {
        if (!geminiApiKey) {
            alert('Gemini API Key is not set. Please go to Settings to add it.');
            return;
        }
        if (!audioFile) return;

        setIsSummarizing(true);
        try {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            // Updating to Gemini 2.0 Flash (latest stable in 2026)
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1beta" });

            // Convert file to base64
            const base64Audio = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.readAsDataURL(audioFile);
            });

            const prompt = `あなたは会議の議事録作成アシスタントです。提供された音声ファイルを解析し、以下の構造で日本語の要約を作成してください：
1. 会議の主な目的
2. 決定事項
3. 次のアクション（担当者含む）
4. その他重要なポイント
簡潔かつ正確にまとめてください。`;

            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: audioFile.type,
                        data: base64Audio
                    }
                },
                { text: prompt },
            ]);

            const response = await result.response;
            setAiSummary(response.text());
        } catch (error: any) {
            console.error('Gemini error:', error);
            if (error.message?.includes('429') || error.message?.toLowerCase().includes('ratelimit')) {
                alert('Gemini APIの利用制限（Rate Limit）に達しました。無料版をご利用の場合、1分間に実行できる回数に制限があります。1分ほど待ってから再度お試しください。');
            } else {
                alert(`Summarization failed: ${error.message}`);
            }
        } finally {
            setIsSummarizing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Summary copied to clipboard!');
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
                                    <section className="space-y-8">
                                        {/* AI Input Section Grid */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* AI Summarization Section */}
                                            <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                                                            <Sparkles className="w-5 h-5" />
                                                        </div>
                                                        <h5 className="font-black text-lg">AI 議事録要約 (Gemini)</h5>
                                                    </div>

                                                    {!aiSummary ? (
                                                        <div className="space-y-4">
                                                            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl bg-white/50 dark:bg-zinc-900/50">
                                                                {audioFile ? (
                                                                    <div className="flex items-center gap-4 w-full">
                                                                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                                                                            <Music className="w-6 h-6" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-bold text-sm truncate">{audioFile.name}</p>
                                                                            <p className="text-[10px] text-zinc-500">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setAudioFile(null)}
                                                                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-5 h-5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="flex flex-col items-center cursor-pointer group">
                                                                        <Mic className="w-12 h-12 text-zinc-300 group-hover:text-indigo-500 transition-colors mb-2" />
                                                                        <span className="text-sm font-bold text-zinc-500 group-hover:text-indigo-600 transition-colors">録音データを選択 (MP3/WAV/AAC)</span>
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            accept="audio/*"
                                                                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={handleSummarize}
                                                                disabled={!audioFile || isSummarizing}
                                                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                                            >
                                                                {isSummarizing ? (
                                                                    <>
                                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                        生成中...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles className="w-4 h-4" />
                                                                        Geminiで要旨を作成
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                                                            <div className="p-6 bg-white dark:bg-zinc-800 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm overflow-hidden relative">
                                                                <div className="absolute top-4 right-4 flex gap-2">
                                                                    <button
                                                                        onClick={() => copyToClipboard(aiSummary)}
                                                                        className="p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg text-zinc-500 hover:text-indigo-600 transition-colors"
                                                                        title="クリップボードにコピー"
                                                                    >
                                                                        <Copy className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setAiSummary(null)}
                                                                        className="p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                                                                        title="破棄"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                                    <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                                        {aiSummary}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-zinc-400 text-center italic">要旨をコピーして、以下のエディタに貼り付けてください。</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Google Drive OCR Section */}
                                            <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-3xl border border-amber-100 dark:border-amber-800 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="p-2 bg-amber-600 rounded-xl text-white">
                                                            <Image className="w-5 h-5" />
                                                        </div>
                                                        <h5 className="font-black text-lg">画像から文字起こし (Drive OCR)</h5>
                                                    </div>

                                                    {ocrResultText ? (
                                                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                                                            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-amber-100 dark:border-amber-800 shadow-sm overflow-hidden relative">
                                                                {/* Top Control Bar */}
                                                                <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-3">
                                                                    {/* Left side: Original/Corrected switcher or Badge */}
                                                                    {ocrOriginalText ? (
                                                                        <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-0.5 text-[10px] font-bold">
                                                                            <button
                                                                                onClick={() => setIsShowingOriginalOcr(false)}
                                                                                className={`px-2.5 py-1 rounded-md transition-all ${!isShowingOriginalOcr ? 'bg-white dark:bg-zinc-800 shadow text-amber-600 dark:text-amber-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                                                                            >
                                                                                AI校正後
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setIsShowingOriginalOcr(true)}
                                                                                className={`px-2.5 py-1 rounded-md transition-all ${isShowingOriginalOcr ? 'bg-white dark:bg-zinc-800 shadow text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                                                                            >
                                                                                校正前
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md">
                                                                            OCR結果（未校正）
                                                                        </span>
                                                                    )}

                                                                    {/* Right side: Action buttons */}
                                                                    <div className="flex gap-1.5 items-center">
                                                                        {!ocrOriginalText && (
                                                                            <button
                                                                                onClick={handleOcrCorrect}
                                                                                disabled={isOcrCorrecting}
                                                                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                                                                title="AIで誤字脱字を自動校正"
                                                                            >
                                                                                {isOcrCorrecting ? (
                                                                                    <>
                                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                                        校正中...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Sparkles className="w-3 h-3" />
                                                                                        AI誤字校正
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => copyToClipboard(isShowingOriginalOcr ? (ocrOriginalText || '') : ocrResultText)}
                                                                            className="p-1.5 bg-zinc-50 dark:bg-zinc-700 rounded-lg text-zinc-500 hover:text-amber-600 transition-colors"
                                                                            title="クリップボードにコピー"
                                                                        >
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        {createdDocId && (
                                                                            <a
                                                                                href={`https://docs.google.com/document/d/${createdDocId}/edit`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="p-1.5 bg-zinc-50 dark:bg-zinc-700 rounded-lg text-zinc-500 hover:text-blue-600 transition-colors flex items-center justify-center"
                                                                                title="Googleドキュメントで開く"
                                                                            >
                                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                            </a>
                                                                        )}
                                                                        <button
                                                                            onClick={() => {
                                                                                setOcrResultText(null);
                                                                                setOcrOriginalText(null);
                                                                                setCreatedDocId(null);
                                                                                setIsShowingOriginalOcr(false);
                                                                            }}
                                                                            className="p-1.5 bg-zinc-50 dark:bg-zinc-700 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                                                                            title="破棄して再選択"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Text Preview */}
                                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                                    <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto pr-2">
                                                                        {isShowingOriginalOcr ? ocrOriginalText : ocrResultText}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-zinc-400 text-center italic">文字起こし結果をコピーして利用できます。</p>
                                                        </div>
                                                    ) : !meetingFolderId && !loadingImages ? (
                                                        <div className="p-5 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800 text-center text-xs text-zinc-500 space-y-3">
                                                            <p className="font-bold text-zinc-700 dark:text-zinc-300">フォルダが見つかりませんでした</p>
                                                            <p>検索対象フォルダ名：「<span className="font-mono text-amber-700 dark:text-amber-400">{selectedTemplate.id === 'improvement' ? '改善活動推進委員会' : '統合情報部門会議'}</span>」</p>
                                                            <p className="text-[10px] opacity-75">Drive内にこの名前のフォルダが存在するか確認してください。</p>
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={findDriveTemplate}
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                    再検索する
                                                                </button>
                                                                <button
                                                                    onClick={debugListAllFolders}
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Drive内のフォルダ一覧を確認
                                                                </button>
                                                            </div>
                                                        </div>

                                                    ) : loadingImages ? (
                                                        <div className="flex flex-col items-center justify-center p-8 text-zinc-500 text-sm">
                                                            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-2" />
                                                            画像を読み込み中...
                                                        </div>
                                                    ) : folderImages.length === 0 ? (
                                                        <div className="p-6 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800 text-center text-xs text-zinc-500 space-y-3">
                                                            <p>フォルダ内に画像ファイル（JPG/PNG等）が見つかりませんでした。</p>
                                                            <p className="text-[10px] opacity-75">（フォルダ名: {selectedTemplate.id === 'improvement' ? '改善活動推進委員会' : '統合情報部門会議'}）</p>
                                                            <button
                                                                onClick={() => meetingFolderId && fetchFolderImages(meetingFolderId)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold transition-all"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                                フォルダを更新
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">対象の画像を選択</label>
                                                                    <select
                                                                        value={selectedImageId}
                                                                        onChange={(e) => setSelectedImageId(e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                                                                    >
                                                                        {folderImages.map((image) => (
                                                                            <option key={image.id} value={image.id}>
                                                                                {image.name} ({new Date(image.modifiedTime).toLocaleDateString('ja-JP')})
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <button
                                                                    onClick={() => meetingFolderId && fetchFolderImages(meetingFolderId)}
                                                                    className="self-end p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                                                                    title="フォルダ内を更新"
                                                                >
                                                                    <RefreshCw className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                                                </button>
                                                            </div>

                                                            {selectedImageId && (
                                                                <div className="flex items-center gap-3 p-3 bg-white/70 dark:bg-zinc-900/70 rounded-xl border border-amber-100/50 dark:border-amber-900/10">
                                                                    {folderImages.find(f => f.id === selectedImageId)?.thumbnailLink ? (
                                                                        <img
                                                                            src={folderImages.find(f => f.id === selectedImageId)?.thumbnailLink}
                                                                            alt="Preview"
                                                                            className="w-12 h-12 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 shrink-0">
                                                                            <FileText className="w-5 h-5" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-bold truncate text-zinc-700 dark:text-zinc-300">
                                                                            {folderImages.find(f => f.id === selectedImageId)?.name}
                                                                        </p>
                                                                        <a
                                                                            href={folderImages.find(f => f.id === selectedImageId)?.webViewLink}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5"
                                                                        >
                                                                            Google Driveで画像を表示
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {meetingFolderId && folderImages.length > 0 && (
                                                    <div className="mt-6">
                                                        <button
                                                            onClick={handleOcrImage}
                                                            disabled={isOcrRunning || !selectedImageId}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                                                        >
                                                            {isOcrRunning ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                        <span>OCR実行中...</span>
                                                                    </div>
                                                                    {ocrProgressText && (
                                                                        <span className="text-[10px] font-normal text-amber-100">{ocrProgressText}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <Image className="w-4 h-4" />
                                                                    文字起こし (Google Docを作成)
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

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
