
# **Interactive Orrery Web App for Celestial Bodies and Space Debris Prediction**

## **Project Overview**
This project is part of a NASA hackathon, aimed at developing an interactive orrery web app that displays various celestial bodies, including planets, Near-Earth Asteroids (NEAs), Near-Earth Comets (NECs), and Potentially Hazardous Asteroids (PHAs). The web app also integrates a high-performance API service to predict space debris movements and potential collisions in real-time.

By addressing the growing issue of space debris, this app provides a powerful tool to help protect critical space infrastructure, ensure the safety of future space missions, and support the sustainable use of Earth’s orbits.

## **Key Features**
- **Interactive 3D Visualizations**: Real-time display of planets, NEAs, NECs, and PHAs with zoom-in and zoom-out functionality.
- **API for Space Debris Prediction**: An API service that predicts debris movement and potential collisions using orbital mechanics.
- **Detailed Information**: Select celestial bodies to get detailed data like their speed, orbit, and proximity to Earth.
- **Embeddable**: The web app can be easily embedded on any webpage.
- **Responsive Design**: Accessible on both desktop and mobile devices.

## **Tech Stack**
- **Frontend**: [Next.js](https://nextjs.org/) – for server-side rendering and optimized performance.
- **Backend**: Custom-built high-performance API for space debris prediction.
- **Data Visualization**: [D3.js](https://d3js.org/) or [Three.js](https://threejs.org/) for rendering celestial objects in 2D/3D.
- **Data Source**: NASA's databases for accurate real-time data on celestial bodies.

## **Installation**
To run the project locally, follow these steps:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-repo/orrery-web-app.git
   cd orrery-web-app
   ```

2. **Install Dependencies**
   Make sure you have Node.js installed. Then, run the following command:
   ```bash
   npm install
   ```

3. **Start the Development Server**
   Start the server and launch the app in development mode:
   ```bash
   npm run dev
   ```
   Open [https://spaceapp-self.vercel.app](https://spaceapp-self.vercel.app) to view the app in your browser.

4. **API Setup**
   If the API service is separate, make sure the backend is set up and running before launching the frontend.
   ```bash
   cd api
   npm install
   npm start
   ```

## **Usage**
1. **Interactive Orrery**: Use the app to visualize celestial objects by zooming in and out. Select an object to view more information.
2. **API Requests**: The API service can be accessed to predict space debris movement and potential collisions. Example API request:
   ```bash
   GET /api/v1/debris/predict?objectId=12345
   ```

## **Future Improvements**
- **Machine Learning Integration**: Leverage machine learning models to improve prediction accuracy for space debris movements.
- **Additional Celestial Objects**: Expand the database to include more celestial bodies such as satellites and distant comets.
- **User Accounts**: Allow users to track specific celestial bodies and receive notifications on potential collisions.
- **Create more visual appealing Bodies**: Enhancing the graphics of the web app; making the celestial bodies more visually appealing.

## **Contributing**
We welcome contributions from the community! Please fork this repository, create a feature branch, and submit a pull request with your changes.

## **License**
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.


