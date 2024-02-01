import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Import Firestore SDK functions
import {
    getFirestore,
    doc,
    collection,
    query,
    orderBy,
    getDocs,
    updateDoc,
    addDoc,
    deleteDoc,
    where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let currentConfigId = null; // Global variable to store the ID of the selected config

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDiEB3YxGXMyTlzln6VuEzgXjOgJGYZtjk",
    authDomain: "bitleadz.firebaseapp.com",
    databaseURL: "https://bitleadz-default-rtdb.firebaseio.com",
    projectId: "bitleadz",
    storageBucket: "bitleadz.appspot.com",
    messagingSenderId: "50500657526",
    appId: "1:50500657526:web:70462744ac29210e1d1a57",
    measurementId: "G-8QNGX5G2SD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Function to enable inline editing of a link block
function enableInlineEditing(linkBlock, docSnapshot) {
    const startEditing = () => {
        // Create an input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = linkBlock.textContent;
        input.className = 'editable-input'; // Add class for styling if needed

        // Style the input field
        input.style.backgroundColor = 'transparent'; // Transparent background
        input.style.border = 'none'; // No border
        input.style.color = 'white'; // White text color

        // Replace text with input field
        linkBlock.innerHTML = '';
        linkBlock.appendChild(input);
        input.focus();

        // Handle focus out event
        input.onblur = () => {
            const newName = input.value.trim();
            if (newName) {
                linkBlock.textContent = newName;
                // Update the document in Firebase
                updateDoc(docSnapshot.ref, { name: newName });
            } else {
                // Revert to original text if input is empty
                linkBlock.textContent = docSnapshot.data().name || `Result ${docSnapshot.id}`;
            }
        };
    };

    // Event listeners for editing
    linkBlock.ondblclick = startEditing; // For double click
    let longPressTimer;
    linkBlock.ontouchstart = () => {
        longPressTimer = setTimeout(startEditing, 1000); // 1000ms for long press
    };
    linkBlock.ontouchend = () => {
        clearTimeout(longPressTimer);
    };
}

// Function to fetch and display all search result documents for the logged-in user
function displayAllSearchResults() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, `Users/${user.uid}`);
    const q = query(collection(userRef, 'SearchResults'), orderBy('timestamp', 'desc'));

    getDocs(q).then((querySnapshot) => {
        const linksContainer = document.getElementById('links-container'); // Container for the links
        const linkTemplate = document.getElementById('link-template'); // Base link block template

        linksContainer.innerHTML = ''; // Clear existing links

        querySnapshot.forEach((docSnapshot) => {
            const linkBlock = linkTemplate.cloneNode(true); // Clone the template
            linkBlock.id = `link-${docSnapshot.id}`; // Use document ID
            linkBlock.style.display = ''; // Make the cloned element visible

            // Set the text for the link block
            linkBlock.textContent = docSnapshot.data().name || `Result ${docSnapshot.id}`;

            // Make the link block editable on double click
            linkBlock.ondblclick = () => {
                const newName = prompt("Edit Result Name:", linkBlock.textContent);
                if (newName) {
                    linkBlock.textContent = newName;
                    // Update the document in Firebase
                    updateDoc(docSnapshot.ref, { name: newName });
                }
            };

            // Enable inline editing for the link block
            enableInlineEditing(linkBlock, docSnapshot);

            // Set click event to render results
            linkBlock.onclick = () => renderResults(docSnapshot.data().results);

            linksContainer.appendChild(linkBlock); // Append the cloned link block
        });
    }).catch((error) => {
        console.error("Error getting documents: ", error);
    });
}

// Function to render each search result into the Webflow elements
function renderResults(results) {
    const resultsContainer = document.getElementById('results-container'); // The container for results
    const template = document.getElementById('result-template'); // The template element

    resultsContainer.innerHTML = ''; // Clear existing results

    results.forEach((result, index) => {
        const resultElement = template.cloneNode(true); // Clone the template
        resultElement.id = `result-${index}`; // Assign a new ID
        resultElement.style.display = ''; // Ensure the cloned element is visible

        // Update the content of the cloned template
        resultElement.querySelector('.result-name').textContent = result.name || '';
        resultElement.querySelector('.result-role').textContent = result.role || '';
        resultElement.querySelector('.result-business').textContent = result.business || '';
        resultElement.querySelector('.result-email').textContent = result.email || '';
        resultElement.querySelector('.result-phone').textContent = result.phone || '';
        resultElement.querySelector('.result-snippet').textContent = result.snippet || '';
        const linkElement = resultElement.querySelector('.result-link');
        if (linkElement) {
            linkElement.href = result.link || '#';
            linkElement.textContent = result.link || '';
        }

        resultsContainer.appendChild(resultElement); // Append the cloned element to the container
    });
}

// Function to save the current search configuration
function saveConfig() {
    const user = auth.currentUser;
    if (!user) {
        console.log('User not logged in');
        return;
    }

    // Build the configuration data
    const configData = buildPayload(); // Assuming buildPayload returns current config
    configData.name = 'New Config'; // Default name for new config

    // Reference to the user's Configs collection
    const configsCollection = collection(db, `Users/${user.uid}/Configs`);

    // Add the new configuration to Firestore
    addDoc(configsCollection, configData)
        .then(() => {
            console.log('Configuration saved successfully');
            displayAllConfigs(); // Refresh the list of configurations
        })
        .catch(error => {
            console.error('Error saving configuration:', error);
        });
}

// Event listener for the save config button
const saveButton = document.getElementById('saveconfig-linkblock');
saveButton.addEventListener('click', saveConfig);

// Function to fetch and display all saved configurations for the logged-in user
function displayAllConfigs() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, `Users/${user.uid}`);
    const q = query(collection(userRef, 'Configs'), orderBy('name'));

    getDocs(q).then((querySnapshot) => {
        const configsContainer = document.getElementById('config-container');
        const configTemplate = document.getElementById('configlink-template');

        // Check if configTemplate is valid
        if (!configTemplate) {
            console.error('configlink-template element not found');
            return;
        }

        configsContainer.innerHTML = '';

        querySnapshot.forEach((docSnapshot) => {
            const configBlock = configTemplate.cloneNode(true);
            configBlock.id = `config-${docSnapshot.id}`;
            configBlock.style.display = '';
            configBlock.textContent = docSnapshot.data().name || `Config ${docSnapshot.id}`;

            enableInlineEditing(configBlock, docSnapshot); // Use the existing inline editing function

            configBlock.onclick = () => loadConfig(docSnapshot.data(), docSnapshot.id);  // Function to load the config

            configsContainer.appendChild(configBlock);
        });
    }).catch((error) => {
        console.error("Error getting configurations: ", error);
    });
}

// Function to load a saved configuration
function loadConfig(configData, configId) {
    document.getElementById('dropdown_country').value = configData.country || '';
    document.getElementById('input_location').value = configData.location || '';
    document.getElementById('input_jobtitle').value = configData.job_title || '';
    document.getElementById('check_searchsimilarjobs').checked = configData.show_similar_jobs || false;
    document.getElementById('input_kywrdsinclude').value = configData.keywords_include.join(',') || '';
    document.getElementById('input_kywrdsexclude').value = configData.keywords_exclude.join(',') || '';
    document.getElementById('dropdown_education').value = configData.education_level || '';
    document.getElementById('input_numberpages').value = configData.num_pages || 1;
    document.getElementById('input_maxresults').value = configData.max_results_per_page || 10;
    document.getElementById('check_usecache').checked = configData.use_cache || false;
    document.getElementById('dropdown_education').value = configData.education_level || '';
    document.getElementById('input_numberpages').value = configData.num_pages || 1;
    document.getElementById('input_maxresults').value = configData.max_results_per_page || 10;
    document.getElementById('check_usecache').checked = configData.use_cache || false;

    // Set additional fields here...
    // Example:
    // document.getElementById('your-field-id').value = configData.yourFieldName || 'default value';

    // Update email domain checkboxes
    const emailDomains = ['gmail', 'hotmail', 'yahoo', 'live', 'aol', 'icloud', 'msn', 'outlook'];
    emailDomains.forEach(domain => {
        const checkbox = document.getElementById(`check_${domain}`);
        if (checkbox) {
            checkbox.checked = configData.email_domains.includes(`${domain}.com`);
        }
    });

    // Handle additional email domains if you have a separate field for them
    if (configData.additional_emails) {
        document.getElementById('input_emails').value = configData.additional_emails.join(',');
    }

    // Set the global variable with the selected config's ID
    currentConfigId = configId;

    // Update the current config text
    const currentConfigText = document.getElementById('current-config-text');
    if (currentConfigText) {
        currentConfigText.textContent = configData.name || 'Unnamed Config';
    }

    // Add similar lines for other fields that are part of your configuration...
    // Ensure the field IDs and object property names match with your setup
}

// Function to delete the currently selected configuration
function deleteCurrentConfig() {
    if (currentConfigId) {
        const userRef = doc(db, `Users/${auth.currentUser.uid}`);
        const configRef = doc(userRef, 'Configs', currentConfigId);

        deleteDoc(configRef).then(() => {
            console.log('Config deleted successfully');
            displayAllConfigs(); // Refresh configs
        }).catch(error => {
            console.error('Error deleting config:', error);
        });
    } else {
        console.log('No config selected for deletion');
    }
}

// Event listener for the delete config button
const deleteButton = document.getElementById('delete-config');
deleteButton.addEventListener('click', deleteCurrentConfig);

// Identify auth action forms
let signUpForm = document.getElementById('wf-form-signup-form');
let signInForm = document.getElementById('wf-form-signin-form');
let signOutButton = document.getElementById('signout-button');

// Assign event listeners for authentication forms
signUpForm && signUpForm.addEventListener('submit', handleSignUp, true);
signInForm && signInForm.addEventListener('submit', handleSignIn, true);
signOutButton && signOutButton.addEventListener('click', handleSignOut);

// Handle Sign Up
function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            // Handle user creation
            const user = userCredential.user;
            console.log('User successfully created:', user.email);
        })
        .catch(error => {
            // Handle errors
            document.getElementById('signup-error-message').innerHTML = error.message;
        });
}

// Handle Sign In
function handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            // Handle user sign in
            const user = userCredential.user;
            console.log('User logged in:', user.email);
        })
        .catch(error => {
            // Handle errors
            document.getElementById('signin-error-message').innerHTML = error.message;
        });
}

// Handle Sign Out
function handleSignOut() {
    signOut(auth)
        .then(() => console.log('User signed out'))
        .catch(error => console.log('Error signing out:', error.message));
}

// Auth State Change Handler
onAuthStateChanged(auth, user => {
    const publicElements = document.querySelectorAll("[data-onlogin='hide']");
    const privateElements = document.querySelectorAll("[data-onlogin='show']");
    if (user) {
        privateElements.forEach(element => element.style.display = "initial");
        publicElements.forEach(element => element.style.display = "none");
        console.log(`The current user's UID is: ${user.uid}`);
        displayAllSearchResults();
        displayAllConfigs();
    } else {
        publicElements.forEach(element => element.style.display = "initial");
        privateElements.forEach(element => element.style.display = "none");
    }
});

// Function to get Firebase ID token
function getFirebaseIdToken() {
    return auth.currentUser ? auth.currentUser.getIdToken(true) : Promise.reject("No user signed in");
}

// Function to build the request payload for LINKLEADRFLASK
function buildPayload() {
    const location = document.getElementById('input_location').value || 'defaultLocation';
    const jobTitle = document.getElementById('input_jobtitle').value || 'defaultJobTitle';
    const similarJobs = document.getElementById('check_searchsimilarjobs').checked;
    const keywordsInclude = document.getElementById('input_kywrdsinclude').value.split(',') || [];
    const keywordsExclude = document.getElementById('input_kywrdsexclude').value.split(',') || [];
    
    const numPages = parseInt(document.getElementById('input_numberpages').value, 10) || 1;
    const maxResults = parseInt(document.getElementById('input_maxresults').value, 10) || 10;
    const useCache = document.getElementById('check_usecache').checked;
  
    // Fetch the values from the custom select fields
    const countrySelectElement = document.querySelector("#dropdown_country select");
    const country = countrySelectElement ? countrySelectElement.value : 'defaultCountry';

    const educationLevelSelectElement = document.querySelector("#dropdown_education select");
    const educationLevel = educationLevelSelectElement ? educationLevelSelectElement.value : 'defaultEducationLevel';

    // Handle email domain checkboxes
    const emailDomains = ['gmail', 'hotmail', 'yahoo', 'live', 'aol', 'icloud', 'msn', 'outlook'];
    const emails = emailDomains.map(domain => {
        const checkbox = document.getElementById(`check_${domain}`);
        return checkbox && checkbox.checked ? `${domain}.com` : null;
    }).filter(email => email);

    // Additional email domains from input
    const additionalEmailsInput = document.getElementById('input_emails');
    const additionalEmails = additionalEmailsInput && additionalEmailsInput.value ? additionalEmailsInput.value.split(',') : [];
    emails.push(...additionalEmails);

    console.log({ country, educationLevel });
  
    return {
        country,
        education_level: educationLevel,
        location,
        job_title: jobTitle,
        show_similar_jobs: similarJobs,
        keywords_include: keywordsInclude,
        keywords_exclude: keywordsExclude,
        education_level: educationLevel,
        num_pages: numPages,
        max_results_per_page: maxResults,
        use_cache: useCache,
        email_domains: emails
    };
}

// Function to handle the search request to LINKLEADRFLASK
function handleSearch() {
    getFirebaseIdToken().then(idToken => {
        const payload = buildPayload();
        fetch('https://linkedinleadgenflaskapp-mq4zdlgqqa-uc.a.run.app/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => console.log('Success:', data))
        .catch(error => console.error('Error:', error));
    }).catch(error => console.error('Error fetching ID token:', error));
}

// Event listener for the search button
document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('button_search');
    searchButton && searchButton.addEventListener('click', handleSearch);
});
