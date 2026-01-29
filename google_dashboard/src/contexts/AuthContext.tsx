import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { gapi } from 'gapi-script';

interface AuthContextType {
    isSignedIn: boolean;
    user: any;
    clientId: string;
    setClientId: (id: string) => void;
    signIn: () => void;
    signOut: () => void;
    isLoaded: boolean;
    isSigningIn: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientId, setClientIdState] = useState(localStorage.getItem('google_client_id') || '');
    const [tokenClient, setTokenClient] = useState<any>(null);

    const setClientId = (id: string) => {
        localStorage.setItem('google_client_id', id);
        setClientIdState(id);
        window.location.reload();
    };

    const fetchUserInfo = async (accessToken: string) => {
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const userData = await resp.json();
            setUser({
                getName: () => userData.name,
                getEmail: () => userData.email,
                getImageUrl: () => userData.picture
            });
        } catch (err) {
            console.error('Error fetching user info:', err);
        }
    };

    const initClient = useCallback(async () => {
        if (!clientId) {
            setIsLoaded(true);
            return;
        }

        try {
            // Load gapi client for data fetching
            await new Promise((resolve) => gapi.load('client', resolve));
            await gapi.client.init({
                discoveryDocs: DISCOVERY_DOCS,
            });

            // Initialize GSI Token Client
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: async (response: any) => {
                    if (response.error) {
                        setError(response.error);
                        setIsSigningIn(false);
                        return;
                    }
                    gapi.client.setToken(response);
                    setIsSignedIn(true);
                    localStorage.setItem('google_access_token', JSON.stringify(response));
                    await fetchUserInfo(response.access_token);
                    setIsSigningIn(false);
                },
            });

            setTokenClient(client);

            // Check for existing token
            const storedToken = localStorage.getItem('google_access_token');
            if (storedToken) {
                const token = JSON.parse(storedToken);
                gapi.client.setToken(token);
                setIsSignedIn(true);
                await fetchUserInfo(token.access_token);
            }

            setIsLoaded(true);
        } catch (err: any) {
            console.error('Detailed Initialization Error:', err);
            setError(`Initialization Error: ${err?.details || err?.error || JSON.stringify(err)}`);
            setIsLoaded(true);
        }
    }, [clientId]);

    useEffect(() => {
        // Wait for both GSI and GAPI to be available
        const checkScripts = setInterval(() => {
            if ((window as any).google?.accounts?.oauth2 && gapi) {
                clearInterval(checkScripts);
                initClient();
            }
        }, 100);
        return () => clearInterval(checkScripts);
    }, [initClient]);

    const signIn = () => {
        if (!tokenClient) {
            setError("Google Identity Services not initialized. Check your Client ID.");
            return;
        }
        setIsSigningIn(true);
        setError(null);
        tokenClient.requestAccessToken({ prompt: 'select_account' });
    };

    const signOut = () => {
        const storedToken = localStorage.getItem('google_access_token');
        if (storedToken) {
            const token = JSON.parse(storedToken);
            (window as any).google.accounts.oauth2.revoke(token.access_token);
        }
        localStorage.removeItem('google_access_token');
        setIsSignedIn(false);
        setUser(null);
        gapi.client.setToken(null);
    };

    return (
        <AuthContext.Provider value={{ isSignedIn, user, clientId, setClientId, signIn, signOut, isLoaded, isSigningIn, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
