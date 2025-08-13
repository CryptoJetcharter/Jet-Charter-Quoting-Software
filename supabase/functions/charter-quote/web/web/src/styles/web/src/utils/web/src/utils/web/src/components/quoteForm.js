document.addEventListener('DOMContentLoaded', async () => {
  // Populate dropdowns
  const originSelect = document.getElementById('origin');
  const destinationSelect = document.getElementById('destination');
  const aircraftTypeSelect = document.getElementById('aircraftType');
  const extrasContainer = document.getElementById('extrasContainer');
  
  // Cache for airports data
  let airports = [];
  
  try {
    // Show loading indicators
    setLoading(true, 'Loading form data...');
    
    // Load airports
    airports = await fetchAirports();
    airports.forEach(airport => {
      const option = document.createElement('option');
      option.value = airport.id;
      option.textContent = `${airport.city} - ${airport.name} (${airport.iata_code})`;
      originSelect.appendChild(option.cloneNode(true));
      destinationSelect.appendChild(option);
    });
    
    // Load aircraft types
    const aircraftTypes = await fetchAircraftTypes();
    aircraftTypes.forEach(aircraft => {
      const option = document.createElement('option');
      option.value = aircraft.id;
      option.textContent = `${aircraft.name} (${aircraft.category}, ${aircraft.max_passengers} passengers)`;
      aircraftTypeSelect.appendChild(option);
    });
    
    // Load extras
    const extras = await fetchExtras();
    extras.forEach(extra => {
      const extraDiv = document.createElement('div');
      extraDiv.className = 'col-md-6 mb-2';
      extraDiv.innerHTML = `
        <div class="form-check">
          <input class="form-check-input extra-checkbox" type="checkbox" value="${extra.id}" id="extra${extra.id}">
          <label class="form-check-label" for="extra${extra.id}">
            ${extra.name} - $${extra.price.toLocaleString('en-US')}
            <small class="d-block text-muted">${extra.description || ''}</small>
          </label>
        </div>
      `;
      extrasContainer.appendChild(extraDiv);
    });
    
    // Hide loading indicator
    setLoading(false);
  } catch (error) {
    console.error('Error loading form data:', error);
    setLoading(false);
    showError('Failed to load form data. Please try again later.');
  }
  
  // Form submission
  const quoteForm = document.getElementById('quoteForm');
  const quoteResult = document.getElementById('quoteResult');
  const quoteDetails = document.getElementById('quoteDetails');
  
  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect selected extras
    const selectedExtras = [];
    document.querySelectorAll('.extra-checkbox:checked').forEach(checkbox => {
      selectedExtras.push(parseInt(checkbox.value));
    });
    
    // Prepare quote data
    const quoteData = {
      origin_id: parseInt(originSelect.value),
      destination_id: parseInt(destinationSelect.value),
      departure_date: document.getElementById('departureDate').value,
      passengers: parseInt(document.getElementById('passengers').value),
      subscription_tier: document.getElementById('subscriptionTier').value,
      extras: selectedExtras,
      promo_code: document.getElementById('promoCode').value || null
    };
    
    // Add optional parameters if provided
    const returnDate = document.getElementById('returnDate').value;
    if (returnDate) {
      quoteData.return_date = returnDate;
    }
    
    const aircraftTypeId = aircraftTypeSelect.value;
    if (aircraftTypeId) {
      quoteData.aircraft_type_id = parseInt(aircraftTypeId);
    }
    
    try {
      // Show loading indicator
      setLoading(true, 'Calculating your quote...');
      
      // Get quote
      const quote = await getQuote(quoteData);
      
      // Track successful quote generation
      trackQuoteGeneration(quote.quote_id, true, {
        origin: quote.flight_details.origin,
        destination: quote.flight_details.destination,
        passengers: quote.flight_details.passengers
      });
      
      // Display quote details
      quoteDetails.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <h5>Flight Details</h5>
            <p><strong>Route:</strong> ${airports.find(a => a.id === quote.flight_details.origin_id).city} to ${airports.find(a => a.id === quote.flight_details.destination_id).city}</p>
            <p><strong>Distance:</strong> ${quote.flight_details.distance_km} km</p>
            <p><strong>Flight Time:</strong> ${quote.flight_details.estimated_flight_time.hours}h ${quote.flight_details.estimated_flight_time.minutes}m</p>
            <p><strong>Passengers:</strong> ${quote.flight_details.passengers}</p>
            <p><strong>Trip Type:</strong> ${quote.flight_details.is_round_trip ? 'Round Trip' : 'One Way'}</p>
          </div>
          <div class="col-md-6">
            <h5>Aircraft</h5>
            <p><strong>Model:</strong> ${quote.aircraft.name}</p>
            <p><strong>Category:</strong> ${quote.aircraft.category}</p>
            <p><strong>Maximum Passengers:</strong> ${quote.aircraft.max_passengers}</p>
            <p><strong>Range:</strong> ${quote.aircraft.range_km} km</p>
            <p><strong>Cruise Speed:</strong> ${quote.aircraft.cruise_speed_kmh} km/h</p>
          </div>
        </div>
        <div class="row mt-3">
          <div class="col-12">
            <h5>Pricing</h5>
            <table class="table table-bordered">
              <tbody>
                <tr>
                  <td>Base Flight Cost</td>
                  <td>$${quote.pricing.flight_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Extra Services</td>
                  <td>$${quote.pricing.extras_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Subscription Discount (${quote.pricing.subscription_discount.percentage}%)</td>
                  <td>-$${quote.pricing.subscription_discount.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Promo Discount</td>
                  <td>-$${quote.pricing.promo_discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Subtotal</td>
                  <td>$${quote.pricing.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Taxes</td>
                  <td>$${quote.pricing.taxes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr class="table-primary">
                  <th>Total</th>
                  <th>$${quote.pricing.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="row mt-3">
          <div class="col-12">
            <div class="alert alert-info">
              <strong>Quote Valid Until:</strong> ${new Date(quote.expires_at).toLocaleString()}
            </div>
            <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
              <button class="btn btn-outline-secondary me-md-2" id="printQuoteBtn">Print Quote</button>
              <button class="btn btn-primary me-md-2" id="saveQuoteBtn">Save Quote</button>
              <a href="${quote.booking_link}" class="btn btn-success">Book This Flight</a>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners for new buttons
      document.getElementById('printQuoteBtn').addEventListener('click', () => {
        window.print();
      });
      
      document.getElementById('saveQuoteBtn').addEventListener('click', () => {
        // Save quote logic - could save to localStorage or prompt download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quote));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `charter-quote-${quote.quote_id}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      });
      
      // Show quote result
      quoteResult.classList.remove('d-none');
      
      // Scroll to quote
      quoteResult.scrollIntoView({ behavior: 'smooth' });
      
      // Hide loading indicator
      setLoading(false);
    } catch (error) {
      console.error('Error getting quote:', error);
      
      // Track failed quote generation
      trackQuoteGeneration(null, false, {
        error: error.message,
        quoteData
      });
      
      setLoading(false);
      showError('Failed to get quote: ' + error.message);
    }
  });
  
  // Helper functions
  function setLoading(isLoading, message = 'Loading...') {
    const submitBtn = quoteForm.querySelector('button[type="submit"]');
    
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}`;
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get Quote';
    }
  }
  
  function showError(message) {
    // Create or update error message
    let errorAlert = document.getElementById('errorAlert');
    
    if (!errorAlert) {
      errorAlert = document.createElement('div');
      errorAlert.className = 'alert alert-danger alert-dismissible fade show mt-3';
      errorAlert.id = 'errorAlert';
      errorAlert.innerHTML = `
        <span id="errorMessage">${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      quoteForm.parentNode.insertBefore(errorAlert, quoteForm);
    } else {
      document.getElementById('errorMessage').textContent = message;
      errorAlert.classList.remove('d-none');
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorAlert) {
        errorAlert.classList.add('d-none');
      }
    }, 5000);
  }
});
