/**
 * Application Translations
 *
 * This file contains all the text strings used in the application,
 * supporting both Nepali (ne) and English (en) languages.
 * Each key maps to an object containing the translations for each language.
 *
 * The `TranslationKey` type is exported to ensure type safety when accessing translations.
 */
// src/lib/translations.ts

export const translations = {
    // --- General ---
    loading: { ne: 'लोड हुँदैछ...', en: 'Loading...' },
    goBackHome: { ne: 'गृहपृष्ठमा फर्कनुहोस्', en: 'Go back to Homepage' },
    // --- Login Page ---
    loginTitle: { ne: 'लगइन गर्नुहोस्', en: 'Login' },
    profileButton: {
    en: "Profile",
    ne: "प्रोफाइल", },
    languageLabel: {
    en: "Language",
    ne: "भाषा", },
    // Example additions or overrides:
    signOutConfirmTitle: { en: "Sign Out", ne: "साइन आउट गर्नुहोस्" },
    newConversation: { en: "New Conversation", ne: "नयाँ वार्तालाप" },
    deleteConversation: { en: "Delete this conversation", ne: "यो वार्तालाप मेटाउनुहोस्" },
    noConversations: { en: "No conversations yet.", ne: "अहिलेसम्म कुनै वार्तालाप छैन।" },
    untitledChat: {
        en: "Untitled Chat",
        ne: "शीर्षक नभएको कुराकानी"
      },
    conversations: { en: "Conversations", ne: "वार्तालापहरू" },
    signOutConfirmBody:  { en: "Are you sure you want to sign out?", ne: "के तपाई साइन आउट गर्न चाहानुहुन्छ?" },
    yesLabel:            { en: "Yes", ne: "हो" },
    noLabel:             { en: "No", ne: "होइन" },
    emailLabel: { ne: 'इमेल:', en: 'Email:' },
    passwordLabel: { ne: 'पासवर्ड:', en: 'Password:' },
    loginButton: { ne: 'लगइन', en: 'Login' },
    loggingInButton: { ne: 'लगइन हुँदैछ...', en: 'Logging in...' },
    noAccount: { ne: 'खाता छैन?', en: 'No account?' },
    registerHere: { ne: 'यहाँ दर्ता गर्नुहोस्', en: 'Register here' },
    errorCredentials: { ne: 'अमान्य इमेल वा पासवर्ड।', en: 'Invalid email or password.' },
    errorInvalidEmail: { ne: 'अमान्य इमेल ढाँचा।', en: 'Invalid email format.' },
    errorTooManyRequests: { ne: 'धेरै पटक असफल प्रयास भयो। कृपया केही बेर पर्खनुहोस्।', en: 'Too many failed attempts. Please wait.' },
    errorLoginFailed: { ne: 'लगइन असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।', en: 'Login failed. Please try again.' },
    errorFillBoth: { ne: 'कृपया इमेल र पासवर्ड दुवै प्रविष्ट गर्नुहोस्।', en: 'Please enter both email and password.' },
    errorNotVerified: { ne: 'लगइन असफल भयो वा इमेल प्रमाणित छैन।', en: 'Login failed or email not verified.' },
    // --- Home Page ---
    // homeTitle: { ne: 'स्वागत छ!', en: 'Welcome!' },
    // homeDescription: {
    //     ne: 'यो नेपाल कानून पत्रीका खोज अनुप्रयोगको गृहपृष्ठ हो। तपाई यहाँबाट खोज पृष्ठमा जान वा साइन आउट गर्न सक्नुहुन्छ।',
    //     en: 'This is the homepage of the Nepal Law Journal search application. You can go to the search page or sign out from here.'
    // },
    // goToSearch: { ne: 'कानून खोज पृष्ठमा जानुहोस्', en: 'Go to Law Search Page' },
    // goToChat: { ne: 'भेस्प च्याटमा जानुहोस्', en: 'Go to Vesp Chat' },
    // signOut: { ne: 'साइन आउट गर्नुहोस्', en: 'Sign Out' },
    editProfileTooltip: { ne: 'प्रोफाइल सम्पादन गर्नुहोस्', en: 'Edit Profile' },
    signOutFailed: { ne: 'साइन आउट गर्न असफल भयो।', en: 'Failed to sign out.' },
    loadingOrAccessDenied: { ne: 'लोड हुँदैछ वा पहुँच अस्वीकृत...', en: 'Loading or Access Denied...' },
    // --- Profile Page ---
    profileTitle: { ne: 'प्रोफाइल सम्पादन गर्नुहोस्', en: 'Edit Profile' },
    personalInfo: { ne: 'व्यक्तिगत जानकारी', en: 'Personal Information' },
    fullNameLabel: { ne: 'पूरा नाम:', en: 'Full Name:' },
    companyNameLabel: { ne: 'कम्पनीको नाम:', en: 'Company Name:' },
    addressLabel: { ne: 'ठेगाना:', en: 'Address:' },
    phoneLabel: { ne: 'फोन नम्बर:', en: 'Phone Number:' },
    saveProfileButton: { ne: 'प्रोफाइल सुरक्षित गर्नुहोस्', en: 'Save Profile' },
    savingProfileButton: { ne: 'अद्यावधिक हुँदै...', en: 'Updating...' },
    profileUpdateSuccess: { ne: 'प्रोफाइल सफलतापूर्वक अद्यावधिक गरियो!', en: 'Profile updated successfully!' },
    profileUpdateError: { ne: "प्रोफाइल अद्यावधिक गर्दा त्रुटि भयो।", en: "Error updating profile." },
    profileFetchError: { ne: 'प्रोफाइल ल्याउन असफल भयो।', en: 'Failed to fetch profile.' },
    profileNotFoundError: { ne: 'प्रोफाइल फेला परेन।', en: 'Profile not found.' },
    fillNameError: { ne: 'कृपया नाम भर्नुहोस्।', en: 'Please fill in the name.' },
    changePasswordTitle: { ne: 'पासवर्ड परिवर्तन गर्नुहोस्', en: 'Change Password' },
    currentPasswordLabel: { ne: 'हालको पासवर्ड:', en: 'Current Password:' },
    newPasswordLabel: { ne: 'नयाँ पासवर्ड:', en: 'New Password:' },
    confirmNewPasswordLabel: { ne: 'नयाँ पासवर्ड पुष्टि गर्नुहोस्:', en: 'Confirm New Password:' },
    changePasswordButton: { ne: 'पासवर्ड परिवर्तन गर्नुहोस्', en: 'Change Password' },
    changingPasswordButton: { ne: 'परिवर्तन हुँदै...', en: 'Changing...' },
    passwordChangeSuccess: { ne: 'पासवर्ड सफलतापूर्वक परिवर्तन गरियो!', en: 'Password changed successfully!' },
    passwordChangeError: { ne: 'पासवर्ड परिवर्तन गर्न असफल भयो।', en: 'Failed to change password.' },
    passwordWrongError: { ne: 'हालको पासवर्ड गलत छ।', en: 'Current password incorrect.' },
    passwordWeakError: { ne: 'नयाँ पासवर्ड कमजोर छ।', en: 'New password is too weak.' },
    passwordMismatchError: { ne: 'नयाँ पासवर्डहरू मेल खाँदैनन्।', en: 'New passwords do not match.' },
    passwordLengthError: { ne: 'नयाँ पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ।', en: 'New password must be at least 6 characters.' },
    passwordFillAllError: { ne: 'कृपया सबै पासवर्ड फिल्डहरू भर्नुहोस्।', en: 'Please fill all password fields.' },
    profileLoading: { ne: 'प्रोफाइल लोड हुँदैछ...', en: 'Loading profile...' },
    loginRequired: { ne: 'पहुँच गर्न लगइन आवश्यक छ।', en: 'Login required to access.' },
    atLeast6Chars: { ne: 'कम्तिमा ६ अक्षर', en: 'At least 6 characters' },
  
    // --- Chat Page ---
    chatTitle: { ne: 'भेस्प च्याट', en: 'Vesp Chat' },
    backButton: { ne: 'पछाडि', en: 'Back' },
    startConversation: { ne: 'कुराकानी सुरु गर्नुहोस्!', en: 'Start a conversation!' },
    typeMessage: { ne: 'आफ्नो सन्देश टाइप गर्नुहोस्...', en: 'Type your message...' },
    sendButton: { ne: 'पठाउनुहोस्', en: 'Send' },
    placeholderResponse: { ne: 'यो एक प्लेसहोल्डर प्रतिक्रिया हो।', en: 'This is a placeholder response.' },
    
    // --- SignUp Page (Add if needed) ---
    signUpTitle: { ne: 'नयाँ खाता दर्ता गर्नुहोस्', en: 'Register New Account' },
    confirmPasswordLabel: { ne: 'पासवर्ड पुष्टि गर्नुहोस्:', en: 'Confirm Password:' },
    registerButton: { ne: 'दर्ता गर्नुहोस्', en: 'Register' },
    registeringButton: { ne: 'दर्ता हुँदैछ...', en: 'Registering...' },
    // ... Add more signup translations as needed

    // --- NEW KEYS ADDED --- 
    errorMessage: {
        ne: 'माफ गर्नुहोस्, केहि गडबड भयो।',
        en: 'Sorry, something went wrong.',
    },
    you: {
        ne: 'तपाईं',
        en: 'You',
    },
    botName: {
        ne: 'बोट',
        en: 'Bot',
    },
    botTyping: {
        ne: 'टाइप गर्दै...',
        en: 'Typing...',
    },
    fileAlreadySelected: { ne: "फाइल पहिले नै चयन गरिएको छ।", en: "File already selected." },
    fileReadError: { ne: "फाइल पढ्न त्रुटि", en: "Error reading file" },
    fileUploadSuccess: { ne: "फाइल सफलतापूर्वक अपलोड भयो", en: "File uploaded successfully" },
    // Add Sign Out button text
    signOutButton: { ne: "साइन आउट", en: "Sign Out" },
    // Add translation for the back button tooltip
    goBack: { ne: "पछाडि जानुहोस्", en: "Go Back" },
    // Add translation for shelf toggle button tooltip
    toggleShelf: { ne: "मेनु टगल गर्नुहोस्", en: "Toggle Menu" },
    // --- END OF NEW KEYS ---
};
  
export type TranslationKey = keyof typeof translations;