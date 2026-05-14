package com.example.backend.repository;

import com.example.backend.entity.Diagram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DiagramRepository extends JpaRepository<Diagram, Long> {
}