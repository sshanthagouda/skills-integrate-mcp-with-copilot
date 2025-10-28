document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Auth related elements
  const loginArea = document.getElementById("login-area");
  const authText = document.getElementById("auth-text");
  const logoutBtn = document.getElementById("logout-btn");
  const teacherOnlyNotice = document.getElementById("teacher-only-notice");
  
  // Authentication state
  let isAuthenticated = false;
  let authToken = localStorage.getItem("authToken");
  
  // Check authentication status on load
  checkAuthStatus();

  // Authentication functions
  async function checkAuthStatus() {
    if (authToken) {
      try {
        const response = await fetch("/auth/verify", {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
        const result = await response.json();
        
        if (result.authenticated) {
          isAuthenticated = true;
          updateAuthUI(result.username);
        } else {
          // Token is invalid, remove it
          localStorage.removeItem("authToken");
          authToken = null;
          isAuthenticated = false;
          updateAuthUI();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        isAuthenticated = false;
        updateAuthUI();
      }
    } else {
      isAuthenticated = false;
      updateAuthUI();
    }
  }

  function updateAuthUI(username = null) {
    if (isAuthenticated && username) {
      authText.textContent = `Logged in as: ${username}`;
      logoutBtn.classList.remove("hidden");
      signupForm.classList.remove("hidden");
      teacherOnlyNotice.classList.add("hidden");
      document.body.classList.add("teacher-mode");
    } else {
      authText.textContent = "Not logged in";
      logoutBtn.classList.add("hidden");
      signupForm.classList.add("hidden");
      teacherOnlyNotice.classList.remove("hidden");
      document.body.classList.remove("teacher-mode");
    }
  }

  // Global functions for the HTML onclick handlers
  window.toggleAuth = function() {
    if (!isAuthenticated) {
      loginArea.classList.toggle("hidden");
    }
  };

  window.closeLogin = function() {
    loginArea.classList.add("hidden");
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  };

  window.login = async function() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }
    
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        authToken = result.access_token;
        localStorage.setItem("authToken", authToken);
        isAuthenticated = true;
        updateAuthUI(result.username);
        closeLogin();
        
        // Refresh activities to show delete buttons
        fetchActivities();
      } else {
        alert(result.detail || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
    }
  };

  window.logout = function() {
    authToken = null;
    localStorage.removeItem("authToken");
    isAuthenticated = false;
    updateAuthUI();
    
    // Refresh activities to hide delete buttons
    fetchActivities();
  };

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isAuthenticated ? `<button class="delete-btn teacher-only-delete" data-activity="${name}" data-email="${email}">❌</button>` : ''
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!isAuthenticated) {
      messageDiv.textContent = "You must be logged in as a teacher to unregister students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      messageDiv.textContent = "You must be logged in as a teacher to register students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
