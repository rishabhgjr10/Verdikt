# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy files using the subfolder context
COPY verdikt-backend/pom.xml .
COPY verdikt-backend/mvnw .
COPY verdikt-backend/.mvn ./.mvn
COPY verdikt-backend/src ./src

# Build executable jar
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

# Stage 2: Create lightweight execution image
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the generated Spring Boot JAR
COPY --from=build /app/target/verdikt-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]