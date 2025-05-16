// ==UserScript==
// @name         Audible AutoLogin Button (All Markets Fixed)
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Auto-login with credentials from local API across all Audible & Amazon marketplaces, with markdown email fix
// @author       You
// @match        *://*.amazon.com/*
// @match        *://*.amazon.ca/*
// @match        *://*.amazon.com.br/*
// @match        *://*.amazon.co.uk/*
// @match        *://*.amazon.de/*
// @match        *://*.amazon.fr/*
// @match        *://*.amazon.es/*
// @match        *://*.amazon.it/*
// @match        *://*.amazon.in/*
// @match        *://*.amazon.co.jp/*
// @match        *://*.amazon.com.au/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject(`Timeout waiting for ${selector}`);
                }
            }, 300);
        });
    }

    function extractMarketplace() {
        const host = window.location.hostname;

        const mappings = {
            'amazon.co.uk': 'uk',
            'audible.co.uk': 'uk',
            'amazon.in': 'in',
            'audible.in': 'in',
            'amazon.com.br': 'br',
            'amazon.ca': 'ca',
            'audible.ca': 'ca',
            'amazon.com.au': 'au',
            'audible.com.au': 'au',
            'amazon.co.jp': 'jp',
            'audible.co.jp': 'jp',
            'amazon.de': 'de',
            'audible.de': 'de',
            'amazon.fr': 'fr',
            'audible.fr': 'fr',
            'amazon.it': 'it',
            'audible.it': 'it',
            'amazon.es': 'es',
            'audible.es': 'es',
            'amazon.com': 'us',
            'audible.com': 'us'
        };

        for (const domain in mappings) {
            if (host.includes(domain)) {
                return mappings[domain];
            }
        }

        return null;
    }

    function extractEmailFromMarkdown(markdown) {
        const start = markdown.indexOf('[');
        const end = markdown.indexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            return markdown.substring(start + 1, end);
        }
        return markdown;
    }

    function addAutoLoginButton() {
        const button = document.createElement('button');
        button.innerText = 'AutoLogin';
        Object.assign(button.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 9999,
            padding: '10px',
            background: '#000',
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '5px',
            cursor: 'pointer'
        });
        document.body.appendChild(button);

        button.addEventListener('click', performLogin);
    }

    function storeUsedAccount(creds) {
        let usedAccounts = JSON.parse(localStorage.getItem('used_accounts')) || [];
        usedAccounts.push(creds);
        localStorage.setItem('used_accounts', JSON.stringify(usedAccounts));
    }

    async function performLogin() {
        const marketplace = extractMarketplace();
        if (!marketplace) {
            alert('Could not determine marketplace.');
            return;
        }

        try {
            const res = await fetch(`http://127.0.0.1:5000/accounts?marketplace=${marketplace}`);
            if (!res.ok) {
                alert("No account found or API error.");
                return;
            }

            const data = await res.json();
            if (!data.length) {
                alert("No accounts returned from API.");
                return;
            }

            const creds = data[0];
            const email = extractEmailFromMarkdown(creds.email);

            sessionStorage.setItem('audible_login_creds', JSON.stringify({
                email: email,
                password: creds.password,
                customer_id: creds.customer_id
            }));

            storeUsedAccount({
                email: email,
                password: creds.password,
                customer_id: creds.customer_id
            });

            const emailInput = await waitForElement("input[name='email'], #ap_email");
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input'));

            const continueBtn = document.querySelector("input#continue, button#continue");
            if (continueBtn) continueBtn.click();

        } catch (err) {
            console.error("Login error:", err);
            alert("Login failed: " + err);
        }
    }

    async function resumeLogin() {
        const creds = sessionStorage.getItem('audible_login_creds');
        if (!creds) return;

        try {
            const parsed = JSON.parse(creds);
            const passwordInput = await waitForElement("input[name='password'], #ap_password");
            passwordInput.value = parsed.password;
            passwordInput.dispatchEvent(new Event('input'));

            const signInBtn = document.querySelector("input#signInSubmit, button#signInSubmit");
            if (signInBtn) signInBtn.click();

            sessionStorage.removeItem('audible_login_creds');
        } catch (err) {
            console.error("Resume login error:", err);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        addAutoLoginButton();
        resumeLogin();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            addAutoLoginButton();
            resumeLogin();
        });
    }
})();
