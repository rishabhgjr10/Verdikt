# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy project files
COPY verdikt-backend/pom.xml .
COPY verdikt-backend/src ./src

# Build executable jar using system mvn
RUN mvn clean package -DskipTests

# Stage 2: Create lightweight execution image
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the generated Spring Boot JAR
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]