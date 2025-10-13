document.addEventListener('DOMContentLoaded', function() {
    // Initialize particles background
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: "#e94560" },
            shape: { type: "circle" },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: "#e94560", opacity: 0.2, width: 1 },
            move: { enable: true, speed: 2, direction: "none", random: true, straight: false, out_mode: "out", bounce: false }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "push" },
                resize: true
            }
        },
        retina_detect: true
    });

    // Hospital Authentication State
    let isHospitalLoggedIn = false;
    let currentHospital = null;

    // --- Hospital Login Functionality ---
    const hospitalLoginForm = document.getElementById('hospital-login-form');
    const hospitalLoginSection = document.getElementById('hospital-login-section');
    const hospitalDashboard = document.getElementById('hospital-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const loginMessage = document.getElementById('login-message');
    const inventoryTabBtn = document.getElementById('inventory-tab-btn');
    const hospitalDisplayName = document.getElementById('hospital-display-name');

    // Check if hospital is already logged in
    checkHospitalLoginStatus();

    if (hospitalLoginForm) {
        hospitalLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('hospital-username').value;
            const password = document.getElementById('hospital-login-password').value;

            try {
                const response = await fetch('/api/hospital/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();
                
                if (response.ok) {
                    // Store login state
                    localStorage.setItem('hospitalLoggedIn', 'true');
                    localStorage.setItem('hospitalName', result.hospitalName);
                    localStorage.setItem('hospitalToken', result.token);
                    
                    isHospitalLoggedIn = true;
                    currentHospital = result.hospitalName;
                    updateHospitalUI();
                    showMessage(loginMessage, 'success', 'Login successful!');
                } else {
                    showMessage(loginMessage, 'error', result.message || 'Login failed.');
                }
            } catch (error) {
                showMessage(loginMessage, 'error', 'Network error. Please try again.');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('hospitalLoggedIn');
            localStorage.removeItem('hospitalName');
            localStorage.removeItem('hospitalToken');
            isHospitalLoggedIn = false;
            currentHospital = null;
            updateHospitalUI();
            // Switch to public tab
            switchToTab('user');
        });
    }

    function checkHospitalLoginStatus() {
        const loggedIn = localStorage.getItem('hospitalLoggedIn') === 'true';
        const hospitalName = localStorage.getItem('hospitalName');
        const token = localStorage.getItem('hospitalToken');
        
        if (loggedIn && hospitalName && token) {
            isHospitalLoggedIn = true;
            currentHospital = hospitalName;
            updateHospitalUI();
        }
    }

    function updateHospitalUI() {
        if (isHospitalLoggedIn) {
            hospitalLoginSection.style.display = 'none';
            hospitalDashboard.style.display = 'block';
            hospitalDisplayName.textContent = currentHospital;
            inventoryTabBtn.style.display = 'block';
            
            // Enable hospital-specific features
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.style.display = 'flex';
            });
        } else {
            hospitalLoginSection.style.display = 'block';
            hospitalDashboard.style.display = 'none';
            inventoryTabBtn.style.display = 'none';
            
            // Disable hospital-specific features
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.style.display = 'none';
            });
            
            // If on a hospital-only tab, switch to user tab
            const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
            if (activeTab === 'inventory') {
                switchToTab('user');
            }
        }
    }

    function switchToTab(tabName) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.click();
        }
    }

    // --- Tab Switching ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Check if hospital login is required for certain tabs
            if ((tabId === 'hospital' || tabId === 'directory' || tabId === 'inventory') && !isHospitalLoggedIn) {
                showMessage(loginMessage, 'error', 'Please login as hospital to access this feature.');
                return;
            }
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            const activeTab = document.getElementById(`${tabId}-tab`);
            if (activeTab) {
                activeTab.classList.add('active');
                // Load data when tab becomes active
                if (tabId === 'directory') {
                    loadDirectoryData();
                }
                if (tabId === 'bloodbanks') {
                    initMap();
                }
                if (tabId === 'inventory') {
                    loadInventoryData();
                }
            }
        });
    });
    
    // --- Phone Number Formatting ---
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.value = '+91';
        phoneInput.addEventListener('input', function(e) {
            let phoneNumber = e.target.value.replace(/\D/g, '');
            if (phoneNumber.length < 2) {
                e.target.value = '+91';
            } else {
                e.target.value = '+91' + phoneNumber.substring(2, 12);
            }
        });
        phoneInput.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.selectionStart <= 3) {
                e.preventDefault();
            }
        });
        phoneInput.addEventListener('focus', function() {
            this.setSelectionRange(this.value.length, this.value.length);
        });
    }

    // --- User Registration Form ---
    const userForm = document.getElementById('user-form');
    const userMessage = document.getElementById('user-message');
    if(userForm) {
        userForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const userData = {
                name: document.getElementById('name').value,
                area: document.getElementById('area').value,
                phone: document.getElementById('phone').value,
                bloodGroup: document.getElementById('blood-group').value
            };
            
            if (!/^\+91\d{10}$/.test(userData.phone)) {
                showMessage(userMessage, 'error', 'Please enter a valid 10-digit Indian phone number.');
                return;
            }
            
            try {
                const response = await fetch('/api/register-donor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                const result = await response.json();
                if (response.ok) {
                    showMessage(userMessage, 'success', 'Thank you for registering! You may save a life soon.');
                    userForm.reset();
                    document.getElementById('phone').value = '+91';
                } else {
                    showMessage(userMessage, 'error', result.message || 'Registration failed.');
                }
            } catch (error) {
                showMessage(userMessage, 'error', 'Network error. Please try again.');
            }
        });
    }

    // --- Hospital Alert Form ---
    const hospitalForm = document.getElementById('hospital-form');
    const hospitalMessage = document.getElementById('hospital-message');
    if(hospitalForm) {
        hospitalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const alertData = {
                hospitalName: document.getElementById('hospital-name').value,
                area: document.getElementById('alert-area').value,
                bloodGroup: document.getElementById('alert-blood-group').value,
                additionalInfo: document.getElementById('additional-info').value
            };
            
            // Add authentication token if logged in
            if (isHospitalLoggedIn) {
                alertData.token = localStorage.getItem('hospitalToken');
            }
            
            try {
                const response = await fetch('/api/send-alert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alertData)
                });
                const result = await response.json();
                if (response.ok) {
                    showMessage(hospitalMessage, 'success', 'Emergency alert sent successfully!');
                    hospitalForm.reset();
                } else {
                    showMessage(hospitalMessage, 'error', result.message || 'Failed to send alert.');
                }
            } catch (error) {
                showMessage(hospitalMessage, 'error', 'Network error. Please try again.');
            }
        });
    }

    // --- Donor Directory Functionality ---
    const filterArea = document.getElementById('filter-area');
    const filterBloodGroup = document.getElementById('filter-blood-group');
    const refreshDirectoryBtn = document.getElementById('refresh-directory');
    const directoryContent = document.querySelector('.directory-content');
    const totalDonorsElement = document.getElementById('total-donors');
    const totalAreasElement = document.getElementById('total-areas');
    const mostCommonBloodElement = document.getElementById('most-common-blood');

    if(refreshDirectoryBtn) {
        refreshDirectoryBtn.addEventListener('click', loadDirectoryData);
        if (filterArea) filterArea.addEventListener('change', loadDirectoryData);
        if (filterBloodGroup) filterBloodGroup.addEventListener('change', loadDirectoryData);
        
        // Initial load if directory tab is active by default
        if (document.querySelector('.tab-btn[data-tab="directory"].active')) {
            loadDirectoryData();
        }
    }

    async function loadDirectoryData() {
        if (!directoryContent) return;
        directoryContent.innerHTML = '<div class="loading">Loading donor data...</div>';
        const refreshIcon = refreshDirectoryBtn?.querySelector('i');
        if (refreshIcon) refreshIcon.classList.add('refreshing');

        try {
            const area = filterArea?.value || 'All';
            const bloodGroup = filterBloodGroup?.value || 'All';
            
            const params = new URLSearchParams();
            if (area !== 'All') params.append('area', area);
            if (bloodGroup !== 'All') params.append('bloodGroup', bloodGroup);
            
            const response = await fetch(`/api/donors?${params.toString()}`);
            const donors = await response.json();
            
            if (!response.ok) throw new Error(donors.message || 'Failed to load data');
            
            displayDirectoryData(donors);
            updateStats(donors);

        } catch (error) {
            console.error('Error loading directory data:', error);
            directoryContent.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading data</h3><p>${error.message}</p></div>`;
        } finally {
            if (refreshIcon) {
                setTimeout(() => refreshIcon.classList.remove('refreshing'), 500);
            }
        }
    }

    function displayDirectoryData(donors) {
        const donorsByArea = donors.reduce((acc, donor) => {
            (acc[donor.area] = acc[donor.area] || []).push(donor);
            return acc;
        }, {});
        
        if (Object.keys(donorsByArea).length === 0) {
            directoryContent.innerHTML = `<div class="empty-state"><i class="fas fa-users-slash"></i><h3>No donors found</h3><p>No donors match your current filters.</p></div>`;
            return;
        }
        
        let html = '';
        Object.keys(donorsByArea).sort().forEach(area => {
            const areaDonors = donorsByArea[area];
            html += `
                <div class="area-section">
                    <div class="area-header">
                        <h3 class="area-title">${area}</h3>
                        <span class="donor-count">${areaDonors.length} donor${areaDonors.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="donor-list">
                        ${areaDonors.map(donor => `
                            <div class="donor-card">
                                <div class="donor-info">
                                    <div class="donor-blood-group">${donor.bloodGroup}</div>
                                    <div class="donor-details">
                                        <h4>${donor.name}</h4>
                                        <p>${maskPhoneNumber(donor.phone)}</p>
                                    </div>
                                </div>
                                <div class="donor-actions">
                                    <button class="info-btn" onclick="showContactInfo()">
                                        <i class="fas fa-phone"></i>
                                        Contact
                                    </button>
                                    ${isHospitalLoggedIn ? `
                                    <button class="delete-btn" onclick="deleteDonor('${donor.phone}')">
                                        <i class="fas fa-trash"></i>
                                        Delete
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        directoryContent.innerHTML = html;
    }

    function updateStats(donors) {
        if (totalDonorsElement) totalDonorsElement.textContent = donors.length;
        if (totalAreasElement) totalAreasElement.textContent = new Set(donors.map(d => d.area)).size;
        
        if (donors.length === 0) {
            if (mostCommonBloodElement) mostCommonBloodElement.textContent = '-';
            return;
        }
        
        const bloodCounts = donors.reduce((acc, donor) => {
            acc[donor.bloodGroup] = (acc[donor.bloodGroup] || 0) + 1;
            return acc;
        }, {});
        
        const mostCommon = Object.keys(bloodCounts).reduce((a, b) => bloodCounts[a] > bloodCounts[b] ? a : b);
        if (mostCommonBloodElement) mostCommonBloodElement.textContent = mostCommon;
    }

    // --- Blood Banks Functionality ---
    const searchBloodbankInput = document.getElementById('search-bloodbank');
    const locateMeBtn = document.getElementById('locate-me');
    let map;
    let markers = [];
    let userLocationMarker = null;
    let bloodBanks = [];

    // Sample blood bank data
    const sampleBloodBanks = [
        {
            name: "Ruby Hall Clinic Blood Bank",
            address: "40, Sassoon Road, Pune, Maharashtra 411001",
            phone: "+91-20-26122101",
            lat: 18.5204,
            lng: 73.8567,
            area: "Shivajinagar"
        },
        {
            name: "KEM Hospital Blood Bank",
            address: "489, Rasta Peth, Sardar Moodliar Road, Pune, Maharashtra 411011",
            phone: "+91-20-26122101",
            lat: 18.5158,
            lng: 73.8550,
            area: "Shivajinagar"
        },
        {
            name: "Sahyadri Hospital Blood Bank",
            address: "Kothrud, Pune, Maharashtra 411038",
            phone: "+91-20-67222222",
            lat: 18.5081,
            lng: 73.8165,
            area: "Kothrud"
        },
        {
            name: "Jehangir Hospital Blood Bank",
            address: "32, Sasoon Road, Pune, Maharashtra 411001",
            phone: "+91-20-66819999",
            lat: 18.5236,
            lng: 73.8478,
            area: "Shivajinagar"
        },
        {
            name: "Sanjeevan Hospital Blood Bank",
            address: "2, Panchavati, Off Karve Road, Pune, Maharashtra 411037",
            phone: "+91-20-25447777",
            lat: 18.5154,
            lng: 73.8298,
            area: "Kothrud"
        },
        {
            name: "Aditya Birla Memorial Hospital Blood Bank",
            address: "Aditya Birla Hospital Marg, Thergaon, Pimpri-Chinchwad, Maharashtra 411033",
            phone: "+91-20-30717100",
            lat: 18.6279,
            lng: 73.7997,
            area: "Pimpri"
        },
        {
            name: "Deenanath Mangeshkar Hospital Blood Bank",
            address: "Erandwane, Pune, Maharashtra 411004",
            phone: "+91-20-40151515",
            lat: 18.5150,
            lng: 73.8290,
            area: "Kothrud"
        },
        {
            name: "Sassoon General Hospital Blood Bank",
            address: "Sassoon Road, Pune, Maharashtra 411001",
            phone: "+91-20-26122101",
            lat: 18.5236,
            lng: 73.8478,
            area: "Shivajinagar"
        }
    ];

    // Initialize the map with OpenStreetMap
    function initMap() {
        // Default center (Pune)
        const pune = [18.5204, 73.8567];
        
        // Create the map
        map = L.map('map').setView(pune, 12);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);

        // Load blood banks
        loadBloodBanks();
        
        // Set up search functionality
        if (searchBloodbankInput) {
            searchBloodbankInput.addEventListener('input', filterBloodBanks);
        }
        
        // Set up locate me button
        if (locateMeBtn) {
            locateMeBtn.addEventListener('click', locateUser);
        }
    }

    function loadBloodBanks() {
        bloodBanks = sampleBloodBanks;
        displayBloodBanks(bloodBanks);
        addBloodBanksToMap(bloodBanks);
        
        // Populate blood bank dropdown for inventory
        populateBloodBankDropdown();
    }

    function displayBloodBanks(bloodBanks) {
        const container = document.getElementById('bloodbanks-list-container');
        if (!container) return;
        
        if (bloodBanks.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-hospital"></i><h3>No blood banks found</h3><p>Try adjusting your search criteria.</p></div>';
            return;
        }
        
        container.innerHTML = bloodBanks.map((bank, index) => `
            <div class="bloodbank-card" data-index="${index}">
                <h4>${bank.name}</h4>
                <p class="address">${bank.address}</p>
                <p class="phone">${bank.phone}</p>
            </div>
        `).join('');
        
        // Add click event listeners to blood bank cards
        document.querySelectorAll('.bloodbank-card').forEach(card => {
            card.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                const bank = bloodBanks[index];
                
                // Highlight the selected card
                document.querySelectorAll('.bloodbank-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                
                // Center the map on the selected blood bank
                map.setView([bank.lat, bank.lng], 15);
                
                // Highlight the marker
                markers[index].openPopup();
            });
        });
    }

    function addBloodBanksToMap(bloodBanks) {
        // Clear existing markers
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        
        bloodBanks.forEach((bank, index) => {
            // Create custom icon
            const bloodBankIcon = L.divIcon({
                html: `<div style="background-color: #e94560; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white;">B</div>`,
                className: 'bloodbank-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker([bank.lat, bank.lng], { icon: bloodBankIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="color: black; padding: 10px; max-width: 250px;">
                        <h3 style="margin: 0 0 10px 0; color: #e94560;">${bank.name}</h3>
                        <p style="margin: 5px 0;"><strong>Address:</strong> ${bank.address}</p>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> ${bank.phone}</p>
                        <p style="margin: 5px 0;"><strong>Area:</strong> ${bank.area}</p>
                    </div>
                `);
            
            marker.on('click', () => {
                // Highlight the corresponding card
                document.querySelectorAll('.bloodbank-card').forEach(c => c.classList.remove('active'));
                const card = document.querySelector(`.bloodbank-card[data-index="${index}"]`);
                if (card) card.classList.add('active');
            });
            
            markers.push(marker);
        });
    }

    function filterBloodBanks() {
        const searchTerm = searchBloodbankInput.value.toLowerCase();
        const filteredBanks = bloodBanks.filter(bank => 
            bank.name.toLowerCase().includes(searchTerm) || 
            bank.address.toLowerCase().includes(searchTerm) ||
            bank.area.toLowerCase().includes(searchTerm)
        );
        
        displayBloodBanks(filteredBanks);
        
        // Clear existing markers and add filtered ones
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        addBloodBanksToMap(filteredBanks);
    }

    function locateUser() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        
        locateMeBtn.disabled = true;
        locateMeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Center map on user location
                map.setView([userLocation.lat, userLocation.lng], 14);
                
                // Add/update user location marker
                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker);
                }
                
                const userIcon = L.divIcon({
                    html: `<div style="background-color: #2ecc71; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>`,
                    className: 'user-location-marker',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                
                userLocationMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup('Your Current Location')
                    .openPopup();
                
                locateMeBtn.disabled = false;
                locateMeBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Locate Me';
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Unable to retrieve your location. Please ensure location services are enabled.');
                
                locateMeBtn.disabled = false;
                locateMeBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Locate Me';
            }
        );
    }

    // --- Blood Inventory Functionality ---
    const addInventoryBtn = document.getElementById('add-inventory-btn');
    const refreshInventoryBtn = document.getElementById('refresh-inventory');
    const inventoryModal = document.getElementById('inventory-modal');
    const closeModal = document.querySelector('.close');
    const inventoryForm = document.getElementById('inventory-form');
    const inventoryContent = document.querySelector('.inventory-content');
    const totalUnitsElement = document.getElementById('total-units');
    const lowStockCountElement = document.getElementById('low-stock-count');
    const inventoryAreasElement = document.getElementById('inventory-areas');

    if (addInventoryBtn) {
        addInventoryBtn.addEventListener('click', () => {
            if (!isHospitalLoggedIn) {
                showMessage(loginMessage, 'error', 'Please login as hospital to manage inventory.');
                return;
            }
            inventoryModal.style.display = 'block';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            inventoryModal.style.display = 'none';
        });
    }

    if (inventoryForm) {
        inventoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inventoryData = {
                bloodBank: document.getElementById('inventory-bloodbank').value,
                bloodGroup: document.getElementById('inventory-blood-group').value,
                units: parseInt(document.getElementById('inventory-units').value),
                minLevel: parseInt(document.getElementById('inventory-min-level').value),
                token: localStorage.getItem('hospitalToken')
            };

            try {
                const response = await fetch('/api/inventory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inventoryData)
                });
                const result = await response.json();
                
                if (response.ok) {
                    showMessage(inventoryForm.querySelector('.message'), 'success', 'Inventory added successfully!');
                    inventoryForm.reset();
                    inventoryModal.style.display = 'none';
                    loadInventoryData();
                } else {
                    showMessage(inventoryForm.querySelector('.message'), 'error', result.message || 'Failed to add inventory.');
                }
            } catch (error) {
                showMessage(inventoryForm.querySelector('.message'), 'error', 'Network error. Please try again.');
            }
        });
    }

    if (refreshInventoryBtn) {
        refreshInventoryBtn.addEventListener('click', loadInventoryData);
    }

    function populateBloodBankDropdown() {
        const dropdown = document.getElementById('inventory-bloodbank');
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Select Blood Bank</option>' +
                bloodBanks.map(bank => `<option value="${bank.name}">${bank.name} (${bank.area})</option>`).join('');
        }
    }

    async function loadInventoryData() {
        if (!inventoryContent) return;
        inventoryContent.innerHTML = '<div class="loading">Loading inventory data...</div>';

        try {
            const response = await fetch('/api/inventory');
            const inventory = await response.json();
            
            if (!response.ok) throw new Error(inventory.message || 'Failed to load inventory');
            
            displayInventoryData(inventory);
            updateInventoryStats(inventory);

        } catch (error) {
            console.error('Error loading inventory data:', error);
            inventoryContent.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error loading inventory</h3><p>${error.message}</p></div>`;
        }
    }

    function displayInventoryData(inventory) {
        if (inventory.length === 0) {
            inventoryContent.innerHTML = `<div class="empty-state"><i class="fas fa-vial"></i><h3>No inventory data</h3><p>Add blood inventory to get started.</p></div>`;
            return;
        }

        let html = '';
        inventory.forEach(item => {
            const stockClass = item.units < item.minLevel ? 
                (item.units === 0 ? 'critical-stock' : 'low-stock') : '';
            
            html += `
                <div class="inventory-item ${stockClass}">
                    <div class="inventory-info">
                        <h4>${item.bloodBank} - ${item.bloodGroup}</h4>
                        <div class="inventory-details">
                            <span class="inventory-detail">
                                <i class="fas fa-map-marker-alt"></i>
                                ${item.area}
                            </span>
                            <span class="inventory-detail">
                                <i class="fas fa-tint"></i>
                                Min Level: ${item.minLevel} units
                            </span>
                            <span class="inventory-detail">
                                <i class="fas fa-clock"></i>
                                Updated: ${new Date(item.updatedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div class="inventory-units">
                        ${item.units} units
                    </div>
                    ${isHospitalLoggedIn ? `
                    <div class="inventory-actions">
                        <button class="delete-btn" onclick="deleteInventoryItem('${item._id}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        inventoryContent.innerHTML = html;
    }

    function updateInventoryStats(inventory) {
        const totalUnits = inventory.reduce((sum, item) => sum + item.units, 0);
        const lowStockCount = inventory.filter(item => item.units < item.minLevel).length;
        const areasWithInventory = new Set(inventory.map(item => item.area)).size;

        if (totalUnitsElement) totalUnitsElement.textContent = totalUnits;
        if (lowStockCountElement) lowStockCountElement.textContent = lowStockCount;
        if (inventoryAreasElement) inventoryAreasElement.textContent = areasWithInventory;
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === inventoryModal) {
            inventoryModal.style.display = 'none';
        }
    });

    // --- Utility Functions ---
    function maskPhoneNumber(phone) {
        // Masks the phone number, e.g., +919876543210 -> +91******3210
        if (typeof phone !== 'string' || phone.length < 13) return phone;
        return `${phone.substring(0, 3)}******${phone.substring(9)}`;
    }
    
    window.showContactInfo = function() {
        alert('For donor privacy, direct contact is unavailable. Please use the "Hospital Alert" system to notify donors in case of an emergency.');
    }

    window.deleteDonor = async function(phone) {
        if (!isHospitalLoggedIn) {
            alert('Please login as hospital to delete donors.');
            return;
        }

        if (!confirm('Are you sure you want to delete this donor?')) {
            return;
        }

        try {
            const response = await fetch(`/api/donor/${phone}`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hospitalToken')}`
                }
            });
            const result = await response.json();
            
            if (response.ok) {
                alert('Donor deleted successfully!');
                loadDirectoryData();
            } else {
                alert(result.message || 'Failed to delete donor.');
            }
        } catch (error) {
            alert('Network error. Please try again.');
        }
    }

    window.deleteInventoryItem = async function(inventoryId) {
        if (!isHospitalLoggedIn) {
            alert('Please login as hospital to delete inventory items.');
            return;
        }

        if (!confirm('Are you sure you want to delete this inventory item?')) {
            return;
        }

        try {
            const response = await fetch(`/api/inventory/${inventoryId}`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hospitalToken')}`
                }
            });
            const result = await response.json();
            
            if (response.ok) {
                alert('Inventory item deleted successfully!');
                loadInventoryData();
            } else {
                alert(result.message || 'Failed to delete inventory item.');
            }
        } catch (error) {
            alert('Network error. Please try again.');
        }
    }

    function showMessage(element, type, text) {
        if (!element) return;
        element.textContent = text;
        element.className = `message ${type}`;
        
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 5000);
    }
    
    // Initialize map when bloodbanks tab is first loaded
    if (document.querySelector('.tab-btn[data-tab="bloodbanks"].active')) {
        initMap();
    }

    // Initialize inventory if tab is active
    if (document.querySelector('.tab-btn[data-tab="inventory"].active')) {
        loadInventoryData();
    }
});