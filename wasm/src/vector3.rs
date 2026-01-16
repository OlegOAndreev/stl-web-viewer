use std::hash::{Hash, Hasher};
use std::ops::{Add, Sub};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[allow(dead_code)]
impl Vector3 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0, z: 0.0 };

    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn cross(self, other: Self) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    pub fn dot(self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn length(self) -> f32 {
        self.dot(self).sqrt()
    }
}

impl Add for Vector3 {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self { x: self.x + other.x, y: self.y + other.y, z: self.z + other.z }
    }
}

impl Sub for Vector3 {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        Self { x: self.x - other.x, y: self.y - other.y, z: self.z - other.z }
    }
}

impl Eq for Vector3 {}

impl Hash for Vector3 {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.x.to_bits().hash(state);
        self.y.to_bits().hash(state);
        self.z.to_bits().hash(state);
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Edge {
    pub from: Vector3,
    pub to: Vector3,
}

impl Edge {
    pub fn new(from: Vector3, to: Vector3) -> Self {
        Self { from, to }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector3_add() {
        let v1 = Vector3::new(1.0, 2.0, 3.0);
        let v2 = Vector3::new(4.0, 5.0, 6.0);
        let result = v1 + v2;
        assert_eq!(result, Vector3::new(5.0, 7.0, 9.0));
    }

    #[test]
    fn test_vector3_sub() {
        let v1 = Vector3::new(5.0, 7.0, 9.0);
        let v2 = Vector3::new(1.0, 2.0, 3.0);
        let result = v1 - v2;
        assert_eq!(result, Vector3::new(4.0, 5.0, 6.0));
    }

    #[test]
    fn test_vector3_add_sub_chain() {
        let v1 = Vector3::new(1.0, 2.0, 3.0);
        let v2 = Vector3::new(4.0, 5.0, 6.0);
        let v3 = Vector3::new(7.0, 8.0, 9.0);

        let result = v1 + v2 - v3;
        assert_eq!(result, Vector3::new(-2.0, -1.0, 0.0));
    }

    #[test]
    fn test_vector3_dot() {
        let v1 = Vector3::new(1.0, 2.0, 3.0);
        let v2 = Vector3::new(4.0, 5.0, 6.0);
        let result = v1.dot(v2);
        assert_eq!(result, 32.0);

        // Test with orthogonal vectors
        let v3 = Vector3::new(1.0, 0.0, 0.0);
        let v4 = Vector3::new(0.0, 1.0, 0.0);
        assert_eq!(v3.dot(v4), 0.0);

        // Test with same vector
        assert_eq!(v3.dot(v3), 1.0);
    }

    #[test]
    fn test_vector3_cross() {
        // Standard basis vectors
        let i = Vector3::new(1.0, 0.0, 0.0);
        let j = Vector3::new(0.0, 1.0, 0.0);
        let k = Vector3::new(0.0, 0.0, 1.0);

        assert_eq!(i.cross(j), k);
        assert_eq!(j.cross(k), i);
        assert_eq!(k.cross(i), j);

        // Test with arbitrary vectors
        let v1 = Vector3::new(1.0, 2.0, 3.0);
        let v2 = Vector3::new(4.0, 5.0, 6.0);
        assert_eq!(v1.cross(v2), Vector3::new(-3.0, 6.0, -3.0));

        // Cross product with itself should be zero vector
        assert_eq!(v1.cross(v1), Vector3::ZERO);
    }

    #[test]
    fn test_vector3_length() {
        assert_eq!(Vector3::ZERO.length(), 0.0);
        assert_eq!(Vector3::new(3.0, 4.0, 0.0).length(), 5.0);
        assert_eq!(Vector3::new(1.0, 2.0, 2.0).length(), 3.0);
        assert_eq!(Vector3::new(-3.0, -4.0, 0.0).length(), 5.0);
    }
}
