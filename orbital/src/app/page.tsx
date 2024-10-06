"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  PerspectiveCamera,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, Info, AlertTriangle, ZoomIn, ZoomOut } from "lucide-react";
import {
  LineChart,
  Line as RechartsLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend as RechartsLegend,
} from "recharts";

// Type definitions
interface SpaceObject {
  id: string;
  name: string;
  type: "satellite" | "asteroid" | "debris" | "comet";
  orbitRadius: number;
  speed: number;
  phase: number;
  inclination: number;
  size: number;
  eccentricity: number;
  perihelion?: number;
  aphelion?: number;
  orbitalPeriod?: number;
  position?: THREE.Vector3;
}

interface NASAApiItem {
  object: string;
  object_name?: string;
  q_au_1: string;
  p_yr: string;
  i_deg: string;
  e: string;
  q_au_2: string;
}

interface Collision {
  obj1: SpaceObject;
  obj2: SpaceObject;
  distance: number;
  timeToCollision?: number;
}

const EARTH_RADIUS = 1;
const MIN_ORBIT_RADIUS = EARTH_RADIUS * 1.5;
const MAX_ORBIT_RADIUS = EARTH_RADIUS * 10;
const MIN_ORBIT_DISTANCE = Math.max(EARTH_RADIUS * 1.2, MIN_ORBIT_RADIUS); // Use the larger of the two

const generateRandomObject = (type: SpaceObject["type"]): SpaceObject => {
  const orbitRadius = Math.max(
    Math.random() * (MAX_ORBIT_RADIUS - MIN_ORBIT_DISTANCE) +
      MIN_ORBIT_DISTANCE,
    MIN_ORBIT_DISTANCE,
  );
  const speed = (Math.random() * 0.2 + 0.1) * (Math.random() < 0.5 ? 1 : -1);
  const eccentricity = Math.random() * 0.5;
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: `${type}-${Math.floor(Math.random() * 1000)}`,
    type,
    orbitRadius,
    speed,
    phase: Math.random() * Math.PI * 2,
    inclination: (Math.random() * Math.PI) / 3,
    size: type === "debris" ? 0.01 : Math.random() * 0.05 + 0.02,
    eccentricity,
  };
};

const generateRandomData = (count: number): SpaceObject[] => {
  const types: SpaceObject["type"][] = ["satellite", "asteroid", "debris"];
  return Array.from({ length: count }, () => {
    const type = types[Math.floor(Math.random() * types.length)];
    return generateRandomObject(type);
  });
};

const fetchNASAData = async (): Promise<SpaceObject[]> => {
  const response = await fetch(
    "https://data.nasa.gov/resource/b67r-rgxc.json?$limit=10",
  );
  const data: NASAApiItem[] = await response.json();
  return data.map((item) => ({
    id: item.object,
    name: item.object_name || item.object,
    type: item.object.startsWith("P/") ? "comet" : "asteroid",
    orbitRadius: Math.max(
      parseFloat(item.q_au_1) * EARTH_RADIUS,
      MIN_ORBIT_DISTANCE,
    ),
    speed: 0.1 / parseFloat(item.p_yr),
    phase: Math.random() * Math.PI * 2,
    inclination: parseFloat(item.i_deg) * (Math.PI / 180),
    size: 0.05,
    eccentricity: parseFloat(item.e),
    perihelion: parseFloat(item.q_au_1),
    aphelion: parseFloat(item.q_au_2),
    orbitalPeriod: parseFloat(item.p_yr),
  }));
};
const detectCollisions = (objects: SpaceObject[]): Collision[] => {
  const collisions: Collision[] = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];
      if (obj1.position && obj2.position) {
        const distance = obj1.position.distanceTo(obj2.position);
        if (distance < obj1.size + obj2.size) {
          collisions.push({ obj1, obj2, distance });
        }
      }
    }
  }
  return collisions;
};

const predictCollisions = (
  objects: SpaceObject[],
  timeSteps: number,
  stepSize: number,
): Collision[] => {
  const predictedCollisions: Collision[] = [];
  for (let step = 1; step <= timeSteps; step++) {
    const futurePositions = objects.map((obj) => {
      const t = step * stepSize * obj.speed;
      const a = Math.max(obj.orbitRadius, MIN_ORBIT_DISTANCE);
      const b = a * Math.sqrt(1 - obj.eccentricity * obj.eccentricity);
      const angle = t + obj.phase;
      const x = a * Math.cos(angle) * Math.cos(obj.inclination);
      const y = b * Math.sin(angle);
      const z = a * Math.cos(angle) * Math.sin(obj.inclination);
      return { ...obj, position: new THREE.Vector3(x, y, z) };
    });

    const stepCollisions = detectCollisions(futurePositions);
    predictedCollisions.push(
      ...stepCollisions.map((c) => ({
        ...c,
        timeToCollision: step * stepSize,
      })),
    );
  }
  return predictedCollisions;
};

const Earth: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(
    () => new THREE.TextureLoader().load("/assets/3d/earth.jpg"),
    [],
  );

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
      <meshStandardMaterial
        map={texture}
        emissive="#444444"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
};

interface SpaceObjectProps {
  object: SpaceObject;
  onClick: (object: SpaceObject) => void;
  setPosition: (id: string, position: THREE.Vector3) => void;
}

const SpaceObject: React.FC<SpaceObjectProps> = ({
  object,
  onClick,
  setPosition,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime() * object.speed;
      const a = Math.max(object.orbitRadius, MIN_ORBIT_DISTANCE);
      const b = a * Math.sqrt(1 - object.eccentricity * object.eccentricity);
      const angle = t + object.phase;

      const x = a * Math.cos(angle) * Math.cos(object.inclination);
      const y = b * Math.sin(angle);
      const z = a * Math.cos(angle) * Math.sin(object.inclination);

      // Ensure minimum distance from Earth's center
      const distance = Math.sqrt(x * x + y * y + z * z);
      const scale = Math.max(distance, MIN_ORBIT_DISTANCE) / distance;

      const finalX = x * scale;
      const finalY = y * scale;
      const finalZ = z * scale;

      meshRef.current.position.set(finalX, finalY, finalZ);
      setPosition(object.id, new THREE.Vector3(finalX, finalY, finalZ));

      // Update trail
      setTrail((prevTrail) => {
        const newTrail = [
          ...prevTrail,
          new THREE.Vector3(finalX, finalY, finalZ),
        ];
        return newTrail.slice(-100); // Keep last 100 positions
      });
    }
  });

  const color = {
    satellite: "#00FFFF", // Cyan
    asteroid: "#FF1493", // Deep Pink
    debris: "#7FFF00", // Chartreuse
    comet: "#FF4500", // Orange Red
  }[object.type];

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      toneMapped: false,
    });
  }, [color]);

  return (
    <>
      <mesh ref={meshRef} onClick={() => onClick(object)}>
        <sphereGeometry args={[object.size, 16, 16]} />
        <primitive object={material} />
      </mesh>
      {trail.length > 1 && (
        <Line
          points={trail}
          color={color}
          lineWidth={1}
          opacity={0.5}
          transparent
        />
      )}
    </>
  );
};

interface SceneProps {
  data: SpaceObject[];
  onObjectClick: (object: SpaceObject) => void;
  setPosition: (id: string, position: THREE.Vector3) => void;
  cameraZoom: number;
  filters: Record<SpaceObject["type"], boolean>;
  followedObject: SpaceObject | null;
}

const Scene: React.FC<SceneProps> = ({
  data,
  onObjectClick,
  setPosition,
  cameraZoom,
  filters,
  followedObject,
}) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const objectPositionsRef = useRef<Record<string, THREE.Vector3>>({});

  useFrame(() => {
    if (followedObject && cameraRef.current) {
      const objectPosition = objectPositionsRef.current[followedObject.id];
      if (objectPosition) {
        cameraRef.current.position
          .copy(objectPosition)
          .add(new THREE.Vector3(0, 0, 5));
        cameraRef.current.lookAt(objectPosition);
      }
    }
  });

  const filteredData = data.filter((object) => filters[object.type]);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0, followedObject ? 5 : cameraZoom]}
      />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <spotLight
        position={[-10, -10, -10]}
        angle={0.15}
        penumbra={1}
        intensity={0.5}
      />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Earth />
      {filteredData.map((object) => (
        <SpaceObject
          key={object.id}
          object={object}
          onClick={onObjectClick}
          setPosition={setPosition}
        />
      ))}
      <OrbitControls enableZoom={false} />
    </>
  );
};

interface ObjectTypeDistributionProps {
  data: SpaceObject[];
}

const ObjectTypeDistribution: React.FC<ObjectTypeDistributionProps> = ({
  data,
}) => {
  const typeStats = data.reduce<
    Record<string, { count: number; totalRadius: number; totalSpeed: number }>
  >((acc, obj) => {
    if (!acc[obj.type]) {
      acc[obj.type] = { count: 0, totalRadius: 0, totalSpeed: 0 };
    }
    acc[obj.type].count += 1;
    acc[obj.type].totalRadius += obj.orbitRadius;
    acc[obj.type].totalSpeed += Math.abs(obj.speed);
    return acc;
  }, {});

  const chartData = Object.entries(typeStats).map(([type, stats]) => ({
    type,
    count: stats.count,
    avgRadius: stats.totalRadius / stats.count,
    avgSpeed: stats.totalSpeed / stats.count,
  }));

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">Object Type Statistics</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis dataKey="name" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <RechartsLegend />
          <RechartsLine
            yAxisId="left"
            type="monotone"
            dataKey="count"
            stroke="#8884d8"
            name="Count"
          />
          <RechartsLine
            yAxisId="left"
            type="monotone"
            dataKey="avgRadius"
            stroke="#82ca9d"
            name="Avg Radius"
          />
          <RechartsLine
            yAxisId="right"
            type="monotone"
            dataKey="avgSpeed"
            stroke="#ffc658"
            name="Avg Speed"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface CollisionAlertProps {
  collision: Collision;
}

const CollisionAlert: React.FC<CollisionAlertProps> = ({ collision }) => (
  <Alert
    className={`mb-4 ${collision.timeToCollision ? "bg-yellow-100 border-yellow-400" : "bg-red-100 border-red-400"}`}
  >
    <AlertTriangle
      className={`h-4 w-4 ${collision.timeToCollision ? "text-yellow-600" : "text-red-600"}`}
    />
    <AlertTitle
      className={collision.timeToCollision ? "text-yellow-700" : "text-red-700"}
    >
      {collision.timeToCollision
        ? "Collision Predicted!"
        : "Collision Detected!"}
    </AlertTitle>
    <AlertDescription>
      <p>Objects involved:</p>
      <ul className="list-disc list-inside">
        <li>
          {collision.obj1.name} ({collision.obj1.type})
        </li>
        <li>
          {collision.obj2.name} ({collision.obj2.type})
        </li>
      </ul>
      <p>Distance: {collision.distance.toFixed(4)} units</p>
      {collision.timeToCollision && (
        <p>
          Time to collision: {collision.timeToCollision.toFixed(2)} time units
        </p>
      )}
    </AlertDescription>
  </Alert>
);

const Legend: React.FC = () => {
  const legendItems = [
    { color: "#FF4500", label: "Comets (NASA data)" },
    { color: "#FF1493", label: "Asteroids (NASA data and random)" },
    { color: "#00FFFF", label: "Satellites (random)" },
    { color: "#7FFF00", label: "Debris (random)" },
  ];

  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-50 p-4 rounded">
      <h3 className="text-lg font-semibold mb-2">Legend</h3>
      {legendItems.map(({ color, label }) => (
        <div key={label} className="flex items-center mb-1">
          <div
            className="w-4 h-4 mr-2"
            style={{ backgroundColor: color }}
          ></div>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
};

const SpaceDebrisVisualization3D: React.FC = () => {
  const [data, setData] = useState<SpaceObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<SpaceObject | null>(
    null,
  );
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const objectPositionsRef = useRef<Record<string, THREE.Vector3>>({});
  const [cameraZoom, setCameraZoom] = useState(15);
  const [filters, setFilters] = useState<Record<SpaceObject["type"], boolean>>({
    satellite: true,
    asteroid: true,
    debris: true,
    comet: true,
  });
  const [followedObject, setFollowedObject] = useState<SpaceObject | null>(
    null,
  );

  const generateNewSample = async () => {
    const nasaData = await fetchNASAData();
    const randomData = generateRandomData(70);
    setData([...nasaData, ...randomData]);
    setSelectedObject(null);
    setCollisions([]);
  };

  useEffect(() => {
    generateNewSample();
  }, []);

  const handleObjectClick = (object: SpaceObject) => {
    setSelectedObject(object);
    setFollowedObject(object);
  };

  const setPosition = (id: string, position: THREE.Vector3) => {
    objectPositionsRef.current[id] = position;
  };

  useEffect(() => {
    const checkCollisions = () => {
      const objects = data.map((obj) => ({
        ...obj,
        position: objectPositionsRef.current[obj.id],
      }));
      const currentCollisions = detectCollisions(objects);
      const predictedCollisions = predictCollisions(objects, 100, 0.1);
      setCollisions((prevCollisions) => {
        const newCollisions = [...currentCollisions, ...predictedCollisions];
        const allCollisions = [...prevCollisions, ...newCollisions];
        // Remove duplicates based on object IDs
        const uniqueCollisions = allCollisions.filter(
          (collision, index, self) =>
            index ===
            self.findIndex(
              (c) =>
                c.obj1.id === collision.obj1.id &&
                c.obj2.id === collision.obj2.id,
            ),
        );
        // Sort by time to collision (if available) or distance
        uniqueCollisions.sort((a, b) => {
          if (a.timeToCollision && b.timeToCollision) {
            return a.timeToCollision - b.timeToCollision;
          }
          return a.distance - b.distance;
        });
        // Return only the 4 most recent collisions
        return uniqueCollisions.slice(0, 4);
      });
    };

    const interval = setInterval(checkCollisions, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const handleZoom = (direction: "in" | "out") => {
    setCameraZoom((prev) => {
      const newZoom = direction === "in" ? prev * 0.9 : prev * 1.1;
      return Math.max(5, Math.min(newZoom, 50)); // Limit zoom between 5 and 50
    });
  };

  const toggleFilter = (type: SpaceObject["type"]) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const stopFollowing = () => {
    setFollowedObject(null);
  };

  return (
    <div className="w-full h-screen flex flex-col md:flex-row bg-gray-900 text-white">
      <div className="w-full md:w-2/3 h-full relative">
        <Canvas>
          <Scene
            data={data}
            onObjectClick={handleObjectClick}
            setPosition={setPosition}
            cameraZoom={cameraZoom}
            filters={filters}
            followedObject={followedObject}
          />
        </Canvas>
        <Legend />
        <div className="absolute bottom-4 right-4 flex space-x-2">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={generateNewSample}
          >
            Generate New Sample
          </button>
          <button
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => handleZoom("in")}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => handleZoom("out")}
          >
            <ZoomOut className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="w-full md:w-1/3 p-4 overflow-y-auto bg-gray-800">
        <h1 className="text-2xl font-bold mb-4">Space Objects and Debris</h1>
        {collisions.map((collision, index) => (
          <CollisionAlert key={index} collision={collision} />
        ))}
        {selectedObject ? (
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertTitle>Selected Object</AlertTitle>
            <AlertDescription>
              <p>Name: {selectedObject.name}</p>
              <p>Type: {selectedObject.type}</p>
              <p>Orbit Radius: {selectedObject.orbitRadius.toFixed(2)}</p>
              <p>Speed: {Math.abs(selectedObject.speed).toFixed(5)}</p>
              <p>Size: {selectedObject.size.toFixed(3)}</p>
              <p>Eccentricity: {selectedObject.eccentricity.toFixed(4)}</p>
              {selectedObject.perihelion && (
                <p>Perihelion: {selectedObject.perihelion.toFixed(4)} AU</p>
              )}
              {selectedObject.aphelion && (
                <p>Aphelion: {selectedObject.aphelion.toFixed(4)} AU</p>
              )}
              {selectedObject.orbitalPeriod && (
                <p>
                  Orbital Period: {selectedObject.orbitalPeriod.toFixed(2)}{" "}
                  years
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This 3D visualization shows a combination of NASA data and
              randomly generated space objects orbiting Earth. The objects are:
              <ul className="list-disc list-inside mt-2">
                <li>Orange Red spheres: Comets (NASA data)</li>
                <li>Deep Pink spheres: Asteroids (NASA data and random)</li>
                <li>Cyan spheres: Satellites (random)</li>
                <li>Chartreuse spheres: Debris (random)</li>
              </ul>
              Click on any object for more information.
            </AlertDescription>
          </Alert>
        )}
        {selectedObject && (
          <button
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={
              followedObject
                ? stopFollowing
                : () => setFollowedObject(selectedObject)
            }
          >
            {followedObject ? "Stop Following" : "Follow Object"}
          </button>
        )}
        <ObjectTypeDistribution data={data} />
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Filters</h2>
          {Object.entries(filters).map(([type, isActive]) => (
            <button
              key={type}
              className={`mr-2 mb-2 px-3 py-1 rounded ${
                isActive ? "bg-blue-500" : "bg-gray-500"
              }`}
              onClick={() => toggleFilter(type as SpaceObject["type"])}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpaceDebrisVisualization3D;

