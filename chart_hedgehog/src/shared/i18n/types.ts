export type Locale = 'ru' | 'en';

export type AppTranslations = {
    languageName: string;
    common: {
        loading: string;
        profile: string;
        home: string;
        diagrams: string;
        participants: string;
        diagram: string;
        backToList: string;
        theme: {
            light: string;
            dark: string;
            toggleToLight: string;
            toggleToDark: string;
        };
    };
    auth: {
        navigationLabel: string;
        loginTitle: string;
        registerTitle: string;
        usernameLabel: string;
        emailLabel: string;
        passwordLabel: string;
        confirmPasswordLabel: string;
        fullNameLabel: string;
        loginButton: string;
        registerButton: string;
        registerLink: string;
        registerPrompt: string;
        registerAction: string;
        loginLink: string;
        loginPrompt: string;
        loginAction: string;
        loginFallbackError: string;
        registerFallbackError: string;
        redirectToLogin: string;
        validation: {
            usernameMin: string;
            usernameMax: string;
            emailInvalid: string;
            passwordMin: string;
            passwordMax: string;
            confirmPasswordRequired: string;
            passwordsMismatch: string;
        };
    };
    home: {
        welcome: (username: string) => string;
        logout: string;
    };
    profile: {
        title: string;
        toDiagrams: string;
        accountData: string;
        username: string;
        email: string;
        fullName: string;
        role: string;
    };
    diagrams: {
        title: string;
        newDiagram: string;
        nameLabel: string;
        namePlaceholder: string;
        create: string;
        participantDiagrams: (count: number) => string;
        empty: string;
        owner: string;
        updated: string;
        invalidId: string;
        notFound: string;
        yourRole: string;
        sectionsLabel: string;
        enterDiagramName: string;
        loadError: string;
        createError: string;
        canvasTitle: string;
        canvasDescription: string;
    };
    participants: {
        addTitle: string;
        addDescription: string;
        userId: string;
        role: string;
        add: string;
        title: (count: number) => string;
        empty: string;
        remove: string;
        enterValidUserId: string;
        alreadyExists: string;
        addError: string;
        removeError: string;
        removeConfirm: (displayName: string) => string;
    };
    roles: Record<string, string>;
};
